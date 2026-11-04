import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Helper to create server client
async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
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
}

// GET: Fetch questions for the live screen view or admin cards view
export async function GET(req: NextRequest) {
  try {
    const supabase = await getSupabase();
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const status = searchParams.get('status');

    let query = supabase
      .from('questions')
      .select('question_id, question_text, status, submitted_at, displayed_at')
      .order('submitted_at', { ascending: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ questions: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to fetch questions' }, { status: 500 });
  }
}

// POST: Submit an anonymous question from the hall
export async function POST(req: NextRequest) {
  try {
    const supabase = await getSupabase();
    const body = await req.json();
    const { question_text } = body;

    if (!question_text || typeof question_text !== 'string' || question_text.trim().length < 5) {
      return NextResponse.json(
        { error: 'Please enter a valid question (at least 5 characters).' },
        { status: 400 }
      );
    }

    if (question_text.trim().length > 600) {
      return NextResponse.json(
        { error: 'Questions must be 600 characters or fewer.' },
        { status: 400 }
      );
    }

    // Insert with status 'approved' so it appears on cards immediately
    const { data, error } = await supabase
      .from('questions')
      .insert({
        question_text: question_text.trim(),
        status: 'approved',
      })
      .select('question_id, question_text, status, submitted_at')
      .single();

    if (error) {
      // 1. Try RPC function submit_anonymous_question
      const { data: rpcData, error: rpcError } = await supabase.rpc('submit_anonymous_question', {
        p_question_text: question_text.trim(),
      });

      if (!rpcError && rpcData) {
        return NextResponse.json({
          success: true,
          message: 'Your question has been submitted anonymously!',
          question: rpcData,
        });
      }

      // 2. Try pending status fallback
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('questions')
        .insert({
          question_text: question_text.trim(),
          status: 'pending',
        })
        .select('question_id, question_text, status, submitted_at')
        .single();

      if (fallbackError) {
        return NextResponse.json({ error: error.message || fallbackError.message }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Your question has been submitted anonymously!',
        question: fallbackData,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Your question has been submitted anonymously!',
      question: data,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update question status (Admin moderation)
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await getSupabase();
    const body = await req.json();
    const { question_id, status } = body;

    if (!question_id || !status) {
      return NextResponse.json({ error: 'Question ID and status required.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('questions')
      .update({ status })
      .eq('question_id', question_id)
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, question: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
