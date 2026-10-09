import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-yps.supabase.co';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
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

    // 1. Authenticate session
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized. Staff login required.' }, { status: 401 });
    }

    // 2. Enforce Admin Role (REQ-5.4.2)
    const { data: staff } = await supabase
      .from('committee_users')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!staff || staff.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Administrator privileges required for CSV export.' },
        { status: 403 }
      );
    }

    // 3. Fetch all registrations ordered by registration date
    const { data: records, error: fetchError } = await supabase
      .from('registrations')
      .select('registration_id, full_name, phone_number, email, church_organisation, age_bracket, gender, registration_status, checkin_status, checked_in_at, registered_at')
      .order('registered_at', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // 4. Construct RFC 4180 CSV
    const headers = [
      'Registration ID',
      'Full Name',
      'Phone Number',
      'Email',
      'Church / Organisation',
      'Age Bracket',
      'Gender',
      'Registration Status',
      'Check-in Status',
      'Checked In At',
      'Registered At',
    ];

    const rows = (records || []).map((r) => [
      escapeCSV(r.registration_id),
      escapeCSV(r.full_name),
      escapeCSV(r.phone_number),
      escapeCSV(r.email),
      escapeCSV(r.church_organisation),
      escapeCSV(r.age_bracket || 'N/A'),
      escapeCSV(r.gender || 'N/A'),
      escapeCSV(r.registration_status),
      escapeCSV(r.checkin_status),
      escapeCSV(r.checked_in_at ? new Date(r.checked_in_at).toISOString() : ''),
      escapeCSV(new Date(r.registered_at).toISOString()),
    ]);

    const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\r\n');

    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `yps_2026_registrations_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
