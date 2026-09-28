-- =============================================================================
-- YPS 2026 - Migration 003: Supabase Storage Buckets & Policies
-- Covers: live_submissions.media_url (SRS §10.4)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- BUCKET: yps-live
-- Stores all YPS Live uploads (Creations + Moments).
-- Public read is intentional — approved images appear in the public feed.
-- Uploads are restricted to authenticated sessions (session_id in path).
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'yps-live',
  'yps-live',
  TRUE,                             -- public bucket: approved images are readable without auth
  5242880,                          -- 5 MB max per file (content safety, SRS §12)
  ARRAY['image/jpeg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- STORAGE POLICIES: yps-live bucket
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "admin_all_yps_live_objects" ON storage.objects;
-- Drop existing policy if it exists
DROP POLICY IF EXISTS "admin_all_yps_live_objects" ON storage.objects;
-- Admin: full access to all objects (moderation — delete inappropriate content)
CREATE POLICY "admin_all_yps_live_objects"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'yps-live'
    AND (SELECT public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'yps-live'
    AND (SELECT public.is_admin())
  );

DROP POLICY IF EXISTS "upload_own_session_objects" ON storage.objects;
CREATE POLICY "upload_own_session_objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'yps-live'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "public_read_yps_live_objects" ON storage.objects;
CREATE POLICY "public_read_yps_live_objects"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'yps-live');

-- ---------------------------------------------------------------------------
-- BUCKET: yps-avatars (future use — committee profile photos, optional)
-- Kept private; Admin only.
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'yps-avatars',
  'yps-avatars',
  FALSE,
  2097152,   -- 2 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "admin_all_yps_avatars" ON storage.objects;
CREATE POLICY "admin_all_yps_avatars"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'yps-avatars'
    AND (SELECT public.is_admin())
  )
  WITH CHECK (
    bucket_id = 'yps-avatars'
    AND (SELECT public.is_admin())
  );
