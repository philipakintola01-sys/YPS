-- =============================================================================
-- YPS 2026 - Migration 004: Enable Realtime for Registrations Table
-- Enables Supabase Realtime change broadcasts for the live check-in counter.
-- =============================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE registrations;
