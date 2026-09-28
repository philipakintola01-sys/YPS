import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
      const { data: commUser } = await supabase
        .from('committee_users')
        .select('role')
        .eq('user_id', user.id)
        .single();

      if (commUser?.role !== 'admin') {
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
        .select('*')
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      return NextResponse.json({ success: true, record: data });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
