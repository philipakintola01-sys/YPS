-- =============================================================================
-- YPS 2026 - Migration 005: Admin-Only Name Edit, Cancellation & Atomic Audit Logging
-- Enforces:
-- 1. registration_audit_logs table with Admin-read only RLS.
-- 2. Partial unique indexes on registrations for active (registered) status,
--    allowing cancelled records to be retained without blocking duplicate re-registration.
-- 3. lookup_registration_id excludes cancelled registrations.
-- 4. Registration Team is strictly forbidden from editing names or cancelling/deleting.
-- 5. Atomic RPCs (admin_cancel_registration, admin_update_attendee_name) that update
--    and log audit rows in the exact same transaction.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. AUDIT LOGS TABLE (Admin Read-Only, System/RPC Insert)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration_audit_logs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id   TEXT        NOT NULL,
  action            TEXT        NOT NULL, -- 'CANCEL', 'UPDATE_NAME', etc.
  performed_by      UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  details           JSONB       NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE registration_audit_logs IS
  'Immutable audit log for registration cancellations and name edits. Readable strictly by Admins.';

CREATE INDEX IF NOT EXISTS idx_reg_audit_reg_id ON registration_audit_logs(registration_id);
CREATE INDEX IF NOT EXISTS idx_reg_audit_created ON registration_audit_logs(created_at DESC);

-- Enable RLS on audit logs
ALTER TABLE registration_audit_logs ENABLE ROW LEVEL SECURITY;

-- Strictly Admin-only read/management policy
DROP POLICY IF EXISTS "admin_all_registration_audit_logs" ON registration_audit_logs;
CREATE POLICY "admin_all_registration_audit_logs"
  ON registration_audit_logs FOR ALL TO authenticated
  USING (is_admin()) WITH CHECK (is_admin());

-- Remove any non-admin read or insert policies to prevent forged audit rows
DROP POLICY IF EXISTS "committee_insert_registration_audit_logs" ON registration_audit_logs;
DROP POLICY IF EXISTS "committee_select_registration_audit_logs" ON registration_audit_logs;
DROP POLICY IF EXISTS "reg_team_insert_registration_audit_logs" ON registration_audit_logs;
DROP POLICY IF EXISTS "reg_team_select_registration_audit_logs" ON registration_audit_logs;

-- ---------------------------------------------------------------------------
-- 2. PARTIAL UNIQUE INDEXES (Handling Active vs Cancelled Registrations)
-- ---------------------------------------------------------------------------
-- Drop whole-table unique constraints if present so cancelled rows do not block re-registration
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_phone_number_key;
ALTER TABLE registrations DROP CONSTRAINT IF EXISTS registrations_email_key;

-- Enforce uniqueness strictly on active ('registered') attendees
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_phone
  ON registrations(phone_number)
  WHERE (registration_status = 'registered');

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_email
  ON registrations(email)
  WHERE (registration_status = 'registered');

-- ---------------------------------------------------------------------------
-- 3. REGISTRATION LOOKUP FUNCTION (Excludes Cancelled Records)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION lookup_registration_id(p_phone TEXT DEFAULT NULL, p_email TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  found_id TEXT;
BEGIN
  SELECT registration_id INTO found_id
  FROM public.registrations
  WHERE ((p_phone IS NOT NULL AND phone_number = p_phone)
     OR (p_email IS NOT NULL AND email = p_email))
    AND registration_status = 'registered'
  LIMIT 1;
  RETURN found_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. STRICT GUARD ON REGISTRATION TEAM (Cannot edit names or cancel)
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

-- Ensure delete policy for registration_team does NOT exist
DROP POLICY IF EXISTS "reg_team_delete_registrations" ON registrations;

-- ---------------------------------------------------------------------------
-- 5. ATOMIC ADMIN RPC: CANCEL REGISTRATION & AUDIT LOG (Same Transaction)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_cancel_registration(
  p_registration_id TEXT,
  p_reason          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_name TEXT;
  v_old_record public.registrations%ROWTYPE;
  v_updated    public.registrations%ROWTYPE;
BEGIN
  -- 1. Strictly verify admin role
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required to cancel registrations.'
      USING ERRCODE = '42501';
  END IF;

  -- 2. Fetch existing registration snapshot
  SELECT * INTO v_old_record
  FROM public.registrations
  WHERE registration_id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration record % not found.', p_registration_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. Fetch admin staff name for audit log
  SELECT name INTO v_staff_name
  FROM public.committee_users
  WHERE user_id = auth.uid();

  -- 4. Update registration status to cancelled (reset checkin if needed)
  UPDATE public.registrations
  SET registration_status = 'cancelled',
      checkin_status      = 'not_checked_in',
      checked_in_at       = NULL,
      checked_in_by       = NULL
  WHERE registration_id = p_registration_id
  RETURNING * INTO v_updated;

  -- 5. Insert immutable audit log in the same atomic transaction
  INSERT INTO public.registration_audit_logs (
    registration_id,
    action,
    performed_by,
    performed_by_name,
    details
  ) VALUES (
    p_registration_id,
    'CANCEL',
    auth.uid(),
    COALESCE(v_staff_name, 'Admin'),
    jsonb_build_object(
      'reason', p_reason,
      'previous_record', to_jsonb(v_old_record),
      'cancelled_at', NOW()
    )
  );

  RETURN to_jsonb(v_updated);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. ATOMIC ADMIN RPC: UPDATE ATTENDEE NAME & AUDIT LOG (Same Transaction)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION admin_update_attendee_name(
  p_registration_id TEXT,
  p_new_name        TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_staff_name TEXT;
  v_old_name   TEXT;
  v_updated    public.registrations%ROWTYPE;
BEGIN
  -- 1. Strictly verify admin role
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required to update attendee names.'
      USING ERRCODE = '42501';
  END IF;

  IF TRIM(COALESCE(p_new_name, '')) = '' THEN
    RAISE EXCEPTION 'Attendee name cannot be empty.'
      USING ERRCODE = '22023';
  END IF;

  -- 2. Fetch previous name
  SELECT full_name INTO v_old_name
  FROM public.registrations
  WHERE registration_id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration record % not found.', p_registration_id
      USING ERRCODE = 'P0002';
  END IF;

  -- 3. Fetch admin staff name
  SELECT name INTO v_staff_name
  FROM public.committee_users
  WHERE user_id = auth.uid();

  -- 4. Update attendee name
  UPDATE public.registrations
  SET full_name = TRIM(p_new_name)
  WHERE registration_id = p_registration_id
  RETURNING * INTO v_updated;

  -- 5. Insert immutable audit log in the same atomic transaction
  INSERT INTO public.registration_audit_logs (
    registration_id,
    action,
    performed_by,
    performed_by_name,
    details
  ) VALUES (
    p_registration_id,
    'UPDATE_NAME',
    auth.uid(),
    COALESCE(v_staff_name, 'Admin'),
    jsonb_build_object(
      'previous_name', v_old_name,
      'new_name', TRIM(p_new_name),
      'updated_at', NOW()
    )
  );

  RETURN to_jsonb(v_updated);
END;
$$;
