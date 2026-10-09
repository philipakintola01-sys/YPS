import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-yps.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    });

    // 1. Verify user authentication session server-side
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Staff login required.' }, { status: 401 });
    }

    const { data: staff } = await supabase.from('committee_users').select('name, role').eq('user_id', user.id).single();
    if (!staff || !['admin', 'registration_team'].includes(staff.role)) {
      return NextResponse.json({ error: 'Authorized staff profile required.' }, { status: 403 });
    }
    const staffName = staff.name || user.email?.split('@')[0] || 'Staff Member';
    const body = await req.json();
    const { registration_id, action } = body;

    if (!registration_id) {
      return NextResponse.json({ error: 'Registration ID is required.' }, { status: 400 });
    }

    // 2. Handle Check-in Action
    if (action === 'checkin') {
      const now = new Date().toISOString();

      const { data, error } = await supabase
        .from('registrations')
        .update({
          checkin_status: 'checked_in',
          checked_in_at: now,
          checked_in_by: user.id, // Strictly set from authenticated session server-side
        })
        .eq('registration_id', registration_id)
        .eq('registration_status', 'registered')
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, record: data });
    }

    // 3. Handle Admin Override Action (re-open check-in)
    if (action === 'reopen') {
      // Check if user is admin
      if (staff.role !== 'admin') {
        return NextResponse.json({ error: 'Admin override permissions required.' }, { status: 403 });
      }

      const { data, error } = await supabase
        .from('registrations')
        .update({
          checkin_status: 'not_checked_in',
          checked_in_at: null,
          checked_in_by: null,
        })
        .eq('registration_id', registration_id)
        .eq('registration_status', 'registered')
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, record: data });
    }

    // 4. Handle Edit Attendee Name Action (Strictly Admin Only)
    if (action === 'update_name') {
      if (staff.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Administrator privileges required to edit attendee names.' }, { status: 403 });
      }

      const trimmedName = typeof body.full_name === 'string' ? body.full_name.trim() : '';
      if (!trimmedName) {
        return NextResponse.json({ error: 'Full name cannot be empty.' }, { status: 400 });
      }

      // Execute via atomic RPC (same transaction) with fallback
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_update_attendee_name', {
        p_registration_id: registration_id,
        p_new_name: trimmedName,
      });

      if (!rpcError && rpcData) {
        return NextResponse.json({ success: true, record: rpcData });
      }

      // Direct fallback if RPC is not yet applied
      const { data: previousRecord } = await supabase
        .from('registrations')
        .select('full_name')
        .eq('registration_id', registration_id)
        .single();

      const { data, error } = await supabase
        .from('registrations')
        .update({ full_name: trimmedName })
        .eq('registration_id', registration_id)
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      await supabase.from('registration_audit_logs').insert({
        registration_id: registration_id,
        action: 'UPDATE_NAME',
        performed_by: user.id,
        performed_by_name: staffName,
        details: {
          previous_name: previousRecord?.full_name || null,
          new_name: trimmedName,
          updated_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({ success: true, record: data });
    }

    // 5. Handle Cancel Registration Action (Strictly Admin Only)
    if (action === 'cancel' || action === 'delete') {
      if (staff.role !== 'admin') {
        return NextResponse.json({ error: 'Unauthorized: Administrator privileges required to cancel registrations.' }, { status: 403 });
      }

      // Execute via atomic RPC (same transaction) with fallback
      const { data: rpcData, error: rpcError } = await supabase.rpc('admin_cancel_registration', {
        p_registration_id: registration_id,
        p_reason: body.reason || 'Admin cancelled registration',
      });

      if (!rpcError && rpcData) {
        return NextResponse.json({ success: true, cancelled_id: registration_id, record: rpcData, audit_logged: true });
      }

      // Direct fallback if RPC is not yet applied
      const { data: attendeeSnapshot } = await supabase
        .from('registrations')
        .select('*')
        .eq('registration_id', registration_id)
        .single();

      if (!attendeeSnapshot) {
        return NextResponse.json({ error: 'Attendee record not found.' }, { status: 404 });
      }

      const { data: updatedRecord, error: updateError } = await supabase
        .from('registrations')
        .update({
          registration_status: 'cancelled',
          checkin_status: 'not_checked_in',
          checked_in_at: null,
          checked_in_by: null,
        })
        .eq('registration_id', registration_id)
        .select('*')
        .single();

      if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
      }

      await supabase.from('registration_audit_logs').insert({
        registration_id: registration_id,
        action: 'CANCEL',
        performed_by: user.id,
        performed_by_name: staffName,
        details: {
          snapshot: attendeeSnapshot,
          reason: body.reason || 'Admin cancelled registration',
          cancelled_at: new Date().toISOString(),
        },
      });

      return NextResponse.json({ success: true, cancelled_id: registration_id, record: updatedRecord, audit_logged: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
