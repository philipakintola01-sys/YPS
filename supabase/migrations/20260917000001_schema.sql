-- =============================================================================
-- YPS 2026 - Migration 001: Core Schema
-- Covers: Section 10 (Data Model) of SRS v1.0
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- ENUMS (Idempotent creation using exception block)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE committee_role AS ENUM ('admin', 'registration_team');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE registration_status AS ENUM ('registered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE checkin_status AS ENUM ('not_checked_in', 'checked_in');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE submission_category AS ENUM ('creation', 'moment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE submission_status AS ENUM ('pending', 'approved', 'removed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE question_status AS ENUM ('pending', 'approved', 'rejected', 'displayed', 'answered');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE field_input_type AS ENUM ('text', 'select', 'radio');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 10.2  COMMITTEE USERS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS committee_users (
  user_id    UUID              PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name       TEXT              NOT NULL,
  role       committee_role    NOT NULL DEFAULT 'registration_team',
  created_at TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE committee_users IS
  'Committee members linked to Supabase Auth. Roles: admin | registration_team.';

-- ---------------------------------------------------------------------------
-- FIELD CONFIG
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS field_config (
  id            UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  field_key     TEXT             NOT NULL UNIQUE,  -- e.g. 'age_bracket', 'gender'
  label         TEXT             NOT NULL,
  input_type    field_input_type NOT NULL DEFAULT 'select',
  options       JSONB,                             -- e.g. ["13-17","18-24","25-35","36+"]
  is_required   BOOLEAN          NOT NULL DEFAULT TRUE,
  is_active     BOOLEAN          NOT NULL DEFAULT TRUE,
  display_order INT              NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE field_config IS
  'Admin-configurable demographic field definitions (REQ-5.1.1). '
  'field_key matches the registrations column or a key inside additional_fields.';

-- Seed default configurable fields
INSERT INTO field_config (field_key, label, input_type, options, is_required, display_order) VALUES
  ('age_bracket', 'Age Bracket', 'select', '["13-17","18-24","25-35","36+"]'::jsonb, TRUE, 1),
  ('gender',      'Gender',      'select', '["Male","Female"]'::jsonb, TRUE, 2)
ON CONFLICT (field_key) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 10.1  REGISTRATIONS
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS registration_suffix_seq START 1000 INCREMENT 1 NO CYCLE;

CREATE TABLE IF NOT EXISTS registrations (
  id                  UUID                PRIMARY KEY DEFAULT uuid_generate_v4(),
  registration_id     TEXT                NOT NULL UNIQUE,   -- YPS26-#### (auto-generated)
  full_name           TEXT                NOT NULL,
  phone_number        TEXT                NOT NULL UNIQUE,   -- REQ-5.1.3
  email               TEXT                NOT NULL UNIQUE,   -- REQ-5.1.3
  church_organisation TEXT                NOT NULL,
  age_bracket         TEXT,                                  -- free-text; options in field_config
  gender              TEXT,                                  -- free-text; options in field_config
  additional_fields   JSONB               NOT NULL DEFAULT '{}', -- extra admin-configured fields
  registration_status registration_status NOT NULL DEFAULT 'registered',
  registered_at       TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  checkin_status      checkin_status       NOT NULL DEFAULT 'not_checked_in',
  checked_in_at       TIMESTAMPTZ,                          -- NULL until check-in occurs
  checked_in_by       UUID                REFERENCES committee_users(user_id) ON DELETE SET NULL,
  CONSTRAINT chk_checkin_consistency CHECK (
    (checkin_status = 'not_checked_in' AND checked_in_at IS NULL  AND checked_in_by IS NULL)
    OR
    (checkin_status = 'checked_in'     AND checked_in_at IS NOT NULL)
  )
);

COMMENT ON TABLE  registrations                  IS 'Attendee registrations. registration_id is the event-day check-in key (REQ-5.2.1).';
COMMENT ON COLUMN registrations.registration_id  IS 'YPS26-#### — auto-generated by trigger set_registration_id.';
COMMENT ON COLUMN registrations.checked_in_by    IS 'Audit trail: which committee user performed check-in (REQ-10.1).';
COMMENT ON COLUMN registrations.additional_fields IS 'Key/value pairs for Admin-added demographic fields (REQ-5.1.1).';

-- Auto-generate registration_id on INSERT
CREATE OR REPLACE FUNCTION generate_registration_id()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.registration_id := 'YPS26-' || LPAD(nextval('registration_suffix_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_registration_id ON registrations;
CREATE TRIGGER set_registration_id
  BEFORE INSERT ON registrations
  FOR EACH ROW
  EXECUTE FUNCTION generate_registration_id();

-- Prevent duplicate check-in (REQ-6.3.2)
CREATE OR REPLACE FUNCTION prevent_duplicate_checkin()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RAISE EXCEPTION
    'Attendee % is already checked in at %. An Admin override is required to re-open check-in.',
    OLD.registration_id, OLD.checked_in_at
    USING ERRCODE = 'P0001';
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_duplicate_checkin ON registrations;
CREATE TRIGGER trg_prevent_duplicate_checkin
  BEFORE UPDATE ON registrations
  FOR EACH ROW
  WHEN (
    OLD.checkin_status = 'checked_in'
    AND NEW.checkin_status = 'checked_in'
    AND OLD.full_name IS NOT DISTINCT FROM NEW.full_name
  )
  EXECUTE FUNCTION prevent_duplicate_checkin();

-- ---------------------------------------------------------------------------
-- REGISTRATION LOOKUP FUNCTION (REQ-5.3.2)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lookup_registration_id(p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  found_id TEXT;
BEGIN
  SELECT registration_id INTO found_id
  FROM public.registrations
  WHERE (p_phone IS NOT NULL AND phone_number = p_phone)
     OR (p_email IS NOT NULL AND email = p_email)
  LIMIT 1;
  RETURN found_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 10.3  LIVE SESSION IDENTITY  (REQ-7.1.1)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_sessions (
  session_id   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT        NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE live_sessions IS
  'Temporary session identities for YPS Live and Ask YPS (REQ-7.1.1). '
  'session_id is issued to the client as a cookie/local token.';

-- ---------------------------------------------------------------------------
-- 10.4  LIVE SUBMISSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS live_submissions (
  submission_id UUID                NOT NULL PRIMARY KEY DEFAULT uuid_generate_v4(),
  category      submission_category NOT NULL,
  session_id    UUID                NOT NULL REFERENCES live_sessions(session_id) ON DELETE CASCADE,
  media_url     TEXT                NOT NULL,  -- Supabase Storage object path
  caption       TEXT,
  like_count    INT                 NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  view_count    INT                 NOT NULL DEFAULT 0 CHECK (view_count >= 0),
  status        submission_status   NOT NULL DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  live_submissions            IS 'YPS Live feed. category: creation (competition) | moment (non-competition).';
COMMENT ON COLUMN live_submissions.like_count IS 'Denormalised; kept in sync by trg_sync_like_count.';
COMMENT ON COLUMN live_submissions.view_count IS 'Denormalised; kept in sync by trg_sync_view_count.';
COMMENT ON COLUMN live_submissions.media_url  IS 'Supabase Storage path, e.g. yps-live/<submission_id>/image.jpg.';

-- ---------------------------------------------------------------------------
-- 10.5  LIKE RECORDS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submission_likes (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID        NOT NULL REFERENCES live_submissions(submission_id) ON DELETE CASCADE,
  session_id    UUID        NOT NULL REFERENCES live_sessions(session_id)       ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_like_per_session UNIQUE (submission_id, session_id)   -- REQ-7.4.1
);

COMMENT ON TABLE submission_likes IS 'One row per (submission, session) like. Unique constraint enforces REQ-7.4.1.';

-- ---------------------------------------------------------------------------
-- 10.5  VIEW RECORDS
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS submission_views (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID        NOT NULL REFERENCES live_submissions(submission_id) ON DELETE CASCADE,
  session_id    UUID        NOT NULL REFERENCES live_sessions(session_id)       ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_view_per_session UNIQUE (submission_id, session_id)   -- REQ-7.4.3
);

COMMENT ON TABLE submission_views IS 'One row per (submission, session) view. Unique constraint enforces REQ-7.4.3.';

-- Trigger: keep like_count in sync
CREATE OR REPLACE FUNCTION sync_like_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE live_submissions SET like_count = like_count + 1 WHERE submission_id = NEW.submission_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE live_submissions SET like_count = GREATEST(like_count - 1, 0) WHERE submission_id = OLD.submission_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_like_count ON submission_likes;
CREATE TRIGGER trg_sync_like_count
  AFTER INSERT OR DELETE ON submission_likes
  FOR EACH ROW EXECUTE FUNCTION sync_like_count();

-- Trigger: keep view_count in sync
CREATE OR REPLACE FUNCTION sync_view_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE live_submissions SET view_count = view_count + 1 WHERE submission_id = NEW.submission_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE live_submissions SET view_count = GREATEST(view_count - 1, 0) WHERE submission_id = OLD.submission_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_view_count ON submission_views;
CREATE TRIGGER trg_sync_view_count
  AFTER INSERT OR DELETE ON submission_views
  FOR EACH ROW EXECUTE FUNCTION sync_view_count();

-- ---------------------------------------------------------------------------
-- 10.6  QUESTIONS  (Ask YPS)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  question_id   UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id    UUID            REFERENCES live_sessions(session_id) ON DELETE SET NULL,
  question_text TEXT            NOT NULL,
  status        question_status NOT NULL DEFAULT 'pending',
  submitted_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  displayed_at  TIMESTAMPTZ,
  CONSTRAINT chk_displayed_at CHECK (
    status NOT IN ('displayed', 'answered') OR displayed_at IS NOT NULL
  )
);

COMMENT ON TABLE  questions             IS 'Ask YPS questions. Lifecycle: pending->approved->displayed->answered | pending->rejected.';
COMMENT ON COLUMN questions.session_id  IS 'NULL is valid for anonymous projector display (SRS §10.6).';

-- Auto-populate displayed_at on first transition to 'displayed'
CREATE OR REPLACE FUNCTION set_displayed_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.displayed_at IS NULL THEN
    NEW.displayed_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_displayed_at ON questions;
CREATE TRIGGER trg_set_displayed_at
  BEFORE UPDATE ON questions
  FOR EACH ROW
  WHEN (NEW.status = 'displayed' AND OLD.status <> 'displayed')
  EXECUTE FUNCTION set_displayed_at();

-- ---------------------------------------------------------------------------
-- 10.7  PAGE VIEWS  (Analytics - SRS §9.3 / §10.7)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS page_views (
  id                 UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  page_path          TEXT        NOT NULL,
  session_identifier TEXT,                  -- anonymous visitor token
  device_type        TEXT,                  -- 'mobile' | 'tablet' | 'desktop'
  referrer           TEXT,
  traffic_source     TEXT,
  recorded_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE page_views IS 'Analytics page-view log (SRS §10.7). Written server-side; read by Admin only.';

-- ---------------------------------------------------------------------------
-- INDEXES
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_reg_id          ON registrations(registration_id);
CREATE INDEX IF NOT EXISTS idx_reg_phone       ON registrations(phone_number);
CREATE INDEX IF NOT EXISTS idx_reg_email       ON registrations(email);
CREATE INDEX IF NOT EXISTS idx_reg_checkin     ON registrations(checkin_status);
CREATE INDEX IF NOT EXISTS idx_reg_registered  ON registrations(registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_sub_category    ON live_submissions(category);
CREATE INDEX IF NOT EXISTS idx_sub_status      ON live_submissions(status);
CREATE INDEX IF NOT EXISTS idx_sub_session     ON live_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_sub_submitted   ON live_submissions(submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_sub_likes       ON live_submissions(like_count DESC);

CREATE INDEX IF NOT EXISTS idx_likes_sub       ON submission_likes(submission_id);
CREATE INDEX IF NOT EXISTS idx_views_sub       ON submission_views(submission_id);

CREATE INDEX IF NOT EXISTS idx_q_status        ON questions(status);
CREATE INDEX IF NOT EXISTS idx_q_submitted     ON questions(submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_pv_path         ON page_views(page_path);
CREATE INDEX IF NOT EXISTS idx_pv_recorded     ON page_views(recorded_at DESC);
