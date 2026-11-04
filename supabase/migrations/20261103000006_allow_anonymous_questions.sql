-- =============================================================================
-- YPS 2026 - Migration 006: Allow Anonymous Question Submissions & Screen View
-- Fixes: "new row violates row-level security policy for table questions"
-- Enables attendees to submit questions without accounts, and allows
-- the stage screen and admin portal to fetch and moderate questions.
-- =============================================================================

-- 1. Enable anonymous question inserts in RLS
DROP POLICY IF EXISTS "anon_insert_question" ON questions;
CREATE POLICY "anon_insert_question"
  ON questions FOR INSERT TO anon, authenticated
  WITH CHECK (
    status IN ('pending', 'approved')
    AND question_text IS NOT NULL
  );

-- 2. Allow public / screen / admin to read questions
DROP POLICY IF EXISTS "public_read_questions" ON questions;
CREATE POLICY "public_read_questions"
  ON questions FOR SELECT TO anon, authenticated
  USING (true);

-- 3. Allow moderation updates (approving / answering questions)
DROP POLICY IF EXISTS "committee_update_questions" ON questions;
CREATE POLICY "committee_update_questions"
  ON questions FOR UPDATE TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- 4. High-reliability SECURITY DEFINER RPC fallback for question submission
CREATE OR REPLACE FUNCTION submit_anonymous_question(p_question_text TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id UUID;
  v_time TIMESTAMPTZ := NOW();
BEGIN
  IF p_question_text IS NULL OR length(trim(p_question_text)) < 5 THEN
    RAISE EXCEPTION 'Question must be at least 5 characters long';
  END IF;

  INSERT INTO public.questions (question_text, status, submitted_at)
  VALUES (trim(p_question_text), 'approved', v_time)
  RETURNING question_id INTO v_id;

  RETURN jsonb_build_object(
    'question_id', v_id,
    'question_text', trim(p_question_text),
    'status', 'approved',
    'submitted_at', v_time
  );
END;
$$;
