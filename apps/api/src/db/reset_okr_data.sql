-- =============================================================================
-- reset_okr_data.sql — wipes all OKR content for a clean start
-- Keeps: users, auth tokens, settings
-- Removes: objectives, key results, check-ins, cycles, appraisals, reviews
-- Run: psql $DATABASE_URL -f apps/api/src/db/reset_okr_data.sql
-- =============================================================================

BEGIN;

TRUNCATE TABLE
  checkins,
  key_results,
  okr_collaborators,
  objectives,
  appraisal_records,
  appraisal_cycles,
  review_items,
  review_cycles,
  okr_cycles,
  audit_log
RESTART IDENTITY CASCADE;

RAISE NOTICE 'All OKR data cleared. Users and settings preserved.';

COMMIT;
