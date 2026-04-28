-- =============================================================================
-- clear_seed.sql  — removes all demo/seed data
-- Run: psql $DATABASE_URL -f apps/api/src/db/clear_seed.sql
-- Safe to run multiple times. Does NOT touch real user accounts.
-- =============================================================================

BEGIN;

-- Seed user emails (from seed.sql)
DO $$
DECLARE
  seed_emails TEXT[] := ARRAY[
    'priya.mehta@capillarytech.com',
    'vikram.nair@capillarytech.com',
    'rajesh.iyer@capillarytech.com',
    'arjun.kapoor@capillarytech.com',
    'anjali.sharma@capillarytech.com',
    'rahul.singh@capillarytech.com',
    'neha.joshi@capillarytech.com',
    'deepa.reddy@capillarytech.com',
    'aditya.kumar@capillarytech.com',
    'sonia.patel@capillarytech.com',
    'kavya.bhat@capillarytech.com',
    'amit.verma@capillarytech.com'
  ];
  seed_user_ids UUID[];
BEGIN
  -- Collect seed user IDs
  SELECT ARRAY_AGG(id) INTO seed_user_ids
  FROM users WHERE email = ANY(seed_emails);

  IF seed_user_ids IS NULL OR array_length(seed_user_ids, 1) = 0 THEN
    RAISE NOTICE 'No seed users found — nothing to delete.';
    RETURN;
  END IF;

  -- Delete check-ins by seed users or on seed users' key results
  DELETE FROM checkins
  WHERE author_id = ANY(seed_user_ids)
     OR key_result_id IN (
       SELECT id FROM key_results WHERE owner_id = ANY(seed_user_ids)
     );

  -- Delete key results owned by seed users
  DELETE FROM key_results WHERE owner_id = ANY(seed_user_ids);

  -- Delete objectives owned by seed users (cascades collaborators, audit, etc.)
  DELETE FROM objectives WHERE owner_id = ANY(seed_user_ids) OR created_by = ANY(seed_user_ids);

  -- Delete appraisal records for seed users
  DELETE FROM appraisal_records WHERE reviewee_id = ANY(seed_user_ids) OR reviewer_id = ANY(seed_user_ids);
  DELETE FROM appraisal_cycles WHERE created_by = ANY(seed_user_ids);

  -- Delete review items for seed users
  DELETE FROM review_items WHERE created_by = ANY(seed_user_ids);
  DELETE FROM review_cycles WHERE created_by = ANY(seed_user_ids);

  -- Delete audit log entries by seed users
  DELETE FROM audit_log WHERE actor_id = ANY(seed_user_ids);

  -- Delete seed users
  DELETE FROM users WHERE id = ANY(seed_user_ids);

  -- Remove demo cycles (Q1 2026 in review + Q2 2026 active, if no real OKRs remain)
  DELETE FROM okr_cycles
  WHERE name IN ('Q1 2026', 'Q2 2026')
    AND NOT EXISTS (
      SELECT 1 FROM objectives WHERE cycle_id = okr_cycles.id
    );

  RAISE NOTICE 'Seed data cleared: % users removed.', array_length(seed_user_ids, 1);
END $$;

COMMIT;
