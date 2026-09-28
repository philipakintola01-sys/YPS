-- =============================================================================
-- YPS 2026 - Migration 002: Row Level Security Policies
-- Covers: Section 3 (User Roles & Permissions) of SRS v1.0
-- REQ-3.1: Backend enforcement, not just hidden navigation links.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- HELPER FUNCTIONS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_committee_role()
RETURNS committee_role
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.committee_users WHERE user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_committee_role() = 'admin';
$$;

CREATE OR REPLACE FUNCTION is_committee()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_committee_role() IN ('admin', 'registration_team');
$$;

CREATE OR REPLACE FUNCTION is_registration_team_only()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.get_committee_role() = 'registration_team';
$$;

-- ---------------------------------------------------------------------------
-- COLUMN-LEVEL UPDATE GUARD for REGISTRATIONS (Registration Team)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_registration_team_update()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF public.get_committee_role() = 'registration_team' THEN
    IF OLD.registration_id     IS DISTINCT FROM NEW.registration_id     OR
       OLD.full_name           IS DISTINCT FROM NEW.full_name           OR
       OLD.phone_number        IS DISTINCT FROM NEW.phone_number        OR
       OLD.email               IS DISTINCT FROM NEW.email               OR
       OLD.church_organisation IS DISTINCT FROM NEW.church_organisation OR
       OLD.age_bracket         IS DISTINCT FROM NEW.age_bracket         OR
       OLD.gender              IS DISTINCT FROM NEW.gender              OR
       OLD.additional_fields   IS DISTINCT FROM NEW.additional_fields   OR
       OLD.registration_status IS DISTINCT FROM NEW.registration_status OR
       OLD.registered_at       IS DISTINCT FROM NEW.registered_at
    THEN
      RAISE EXCEPTION
        'Registration Team may only update check-in fields (checkin_status, checked_in_at, checked_in_by).'
        USING ERRCODE = 'P0002';
    END IF;

    IF OLD.checkin_status = 'checked_in' AND NEW.checkin_status = 'not_checked_in' THEN
      RAISE EXCEPTION 'Registration Team cannot undo a check-in. Admin override required.'
      USING ERRCODE = 'P0003';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_reg_team_update ON registrations;
CREATE TRIGGER trg_enforce_reg_team_update
  BEFORE UPDATE ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION enforce_registration_team_update();

-- =============================================================================
-- ENABLE ROW LEVEL SECURITY on every table
-- =============================================================================
ALTER TABLE committee_users    ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_config       ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_submissions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_likes   ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_views   ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views         ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- TABLE: committee_users
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_committee_users" ON committee_users;
CREATE POLICY "admin_all_committee_users"
  ON committee_users FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "reg_team_read_own_committee_user" ON committee_users;
CREATE POLICY "reg_team_read_own_committee_user"
  ON committee_users FOR SELECT TO authenticated
  USING (is_registration_team_only() AND user_id = auth.uid());

-- =============================================================================
-- TABLE: field_config
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_field_config" ON field_config;
CREATE POLICY "admin_all_field_config"
  ON field_config FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "reg_team_read_field_config" ON field_config;
CREATE POLICY "reg_team_read_field_config"
  ON field_config FOR SELECT TO authenticated
  USING (is_registration_team_only() AND is_active = TRUE);

DROP POLICY IF EXISTS "anon_read_active_field_config" ON field_config;
CREATE POLICY "anon_read_active_field_config"
  ON field_config FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- =============================================================================
-- TABLE: registrations
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_registrations" ON registrations;
CREATE POLICY "admin_all_registrations"
  ON registrations FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "reg_team_select_registrations" ON registrations;
CREATE POLICY "reg_team_select_registrations"
  ON registrations FOR SELECT TO authenticated
  USING (is_registration_team_only());

DROP POLICY IF EXISTS "reg_team_update_registrations" ON registrations;
CREATE POLICY "reg_team_update_registrations"
  ON registrations FOR UPDATE TO authenticated
  USING (is_registration_team_only()) WITH CHECK (is_registration_team_only());

DROP POLICY IF EXISTS "anon_insert_registration" ON registrations;
CREATE POLICY "anon_insert_registration"
  ON registrations FOR INSERT TO anon, authenticated
  WITH CHECK (
    registration_status = 'registered'
    AND checkin_status = 'not_checked_in'
    AND checked_in_at IS NULL
    AND checked_in_by IS NULL
  );

-- =============================================================================
-- TABLE: live_sessions
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_live_sessions" ON live_sessions;
CREATE POLICY "admin_all_live_sessions"
  ON live_sessions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_own_live_session" ON live_sessions;
CREATE POLICY "insert_own_live_session"
  ON live_sessions FOR INSERT TO authenticated
  WITH CHECK (session_id = auth.uid());

DROP POLICY IF EXISTS "read_own_live_session" ON live_sessions;
CREATE POLICY "read_own_live_session"
  ON live_sessions FOR SELECT TO authenticated
  USING (session_id = auth.uid());

-- =============================================================================
-- TABLE: live_submissions
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_live_submissions" ON live_submissions;
CREATE POLICY "admin_all_live_submissions"
  ON live_submissions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_own_live_submission" ON live_submissions;
CREATE POLICY "insert_own_live_submission"
  ON live_submissions FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND session_id = auth.uid()
  );

DROP POLICY IF EXISTS "read_approved_submissions" ON live_submissions;
CREATE POLICY "read_approved_submissions"
  ON live_submissions FOR SELECT TO anon, authenticated
  USING (status = 'approved');

-- =============================================================================
-- TABLE: submission_likes
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_likes" ON submission_likes;
CREATE POLICY "admin_all_likes"
  ON submission_likes FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_own_like" ON submission_likes;
CREATE POLICY "insert_own_like"
  ON submission_likes FOR INSERT TO authenticated
  WITH CHECK (session_id = auth.uid());

DROP POLICY IF EXISTS "read_own_likes" ON submission_likes;
CREATE POLICY "read_own_likes"
  ON submission_likes FOR SELECT TO authenticated
  USING (session_id = auth.uid());

-- =============================================================================
-- TABLE: submission_views
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_views" ON submission_views;
CREATE POLICY "admin_all_views"
  ON submission_views FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_own_view" ON submission_views;
CREATE POLICY "insert_own_view"
  ON submission_views FOR INSERT TO authenticated
  WITH CHECK (session_id = auth.uid());

DROP POLICY IF EXISTS "read_own_views" ON submission_views;
CREATE POLICY "read_own_views"
  ON submission_views FOR SELECT TO authenticated
  USING (session_id = auth.uid());

-- =============================================================================
-- TABLE: questions
-- =============================================================================
DROP POLICY IF EXISTS "admin_all_questions" ON questions;
CREATE POLICY "admin_all_questions"
  ON questions FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "insert_own_question" ON questions;
CREATE POLICY "insert_own_question"
  ON questions FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND session_id = auth.uid()
  );

-- =============================================================================
-- TABLE: page_views
-- =============================================================================
DROP POLICY IF EXISTS "admin_read_page_views" ON page_views;
CREATE POLICY "admin_read_page_views"
  ON page_views FOR SELECT TO authenticated
  USING (is_admin());

-- =============================================================================
-- REALTIME PUBLICATIONS
-- =============================================================================
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE live_submissions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE questions;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
