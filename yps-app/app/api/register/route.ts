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

    const body = await req.json();
    const { full_name, phone_number, email, church_organisation, age_bracket, gender } = body;

    if (!full_name?.trim() || !phone_number?.trim() || !email?.trim() || !church_organisation?.trim()) {
      return NextResponse.json(
        { error: 'Full name, phone number, email, and church/organisation are required.' },
        { status: 400 }
      );
    }

    const cleanedPhone = phone_number.trim();
    const cleanedEmail = email.trim().toLowerCase();

    // Perform registration insert
    const { data, error } = await supabase
      .from('registrations')
      .insert({
        full_name: full_name.trim(),
        phone_number: cleanedPhone,
        email: cleanedEmail,
        church_organisation: church_organisation.trim(),
        age_bracket: age_bracket || null,
        gender: gender || null,
        registration_status: 'registered',
        checkin_status: 'not_checked_in',
      })
      .select('registration_id, full_name, phone_number, email, church_organisation, registered_at')
      .single();

    if (error) {
      // Catch Unique Constraint Violations (code 23505) for duplicate phone or email
      if (error.code === '23505' || error.message.includes('unique') || error.message.includes('duplicate')) {
        const { data: recoveredId } = await supabase.rpc('lookup_registration_id', {
          p_phone: cleanedPhone,
          p_email: cleanedEmail,
        });

        if (recoveredId) {
          return NextResponse.json({
            duplicate: true,
            registration_id: recoveredId,
            message: 'A registration record with your phone number or email already exists.',
          });
        }
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, record: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
