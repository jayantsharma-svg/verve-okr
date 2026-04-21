-- =============================================================================
-- OKR Tool — PostgreSQL Schema
-- =============================================================================
-- Run with: psql -d okr_tool -f schema.sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";     -- fuzzy text search on objectives

-- DATE(timestamptz) is STABLE (timezone-dependent) so can't be used in indexes.
-- This wrapper locks it to UTC and declares IMMUTABLE so index creation succeeds.
CREATE OR REPLACE FUNCTION utc_date(ts TIMESTAMPTZ)
RETURNS DATE LANGUAGE sql IMMUTABLE AS
$$ SELECT (ts AT TIME ZONE 'UTC')::date $$;

-- =============================================================================
-- ENUMS
-- =============================================================================

CREATE TYPE user_role        AS ENUM ('admin', 'dept_lead', 'team_lead', 'member');
CREATE TYPE auth_type        AS ENUM ('google_sso', 'email_password');
CREATE TYPE okr_level        AS ENUM ('company', 'department', 'team', 'individual');
CREATE TYPE okr_status       AS ENUM ('draft', 'pending_approval', 'active', 'closed', 'deleted');
CREATE TYPE visibility_type  AS ENUM ('public', 'private');
CREATE TYPE metric_type      AS ENUM ('percentage', 'number', 'currency', 'binary');
CREATE TYPE confidence_level AS ENUM ('on_track', 'at_risk', 'off_track');
CREATE TYPE cycle_type       AS ENUM ('annual', 'monthly', 'custom');
CREATE TYPE cycle_status     AS ENUM ('planning', 'active', 'review', 'closed');
CREATE TYPE review_scope     AS ENUM ('company', 'department', 'team');
CREATE TYPE review_status    AS ENUM ('pending', 'submitted', 'approved', 'revision_requested');
CREATE TYPE collab_status    AS ENUM ('pending', 'accepted', 'declined');
CREATE TYPE notif_channel    AS ENUM ('slack', 'gmail');
CREATE TYPE bulk_job_type    AS ENUM ('create', 'update');
CREATE TYPE bulk_job_status  AS ENUM ('pending', 'validating', 'preview', 'committed', 'failed');
CREATE TYPE scrape_consent   AS ENUM ('none', 'capture_all', 'capture_confirm');
CREATE TYPE scrape_schedule  AS ENUM ('manual', 'end_of_day', 'end_of_week', 'end_of_period');
CREATE TYPE scrape_job_status AS ENUM ('pending', 'running', 'completed', 'failed');
CREATE TYPE extract_decision AS ENUM ('pending', 'accepted', 'rejected');
CREATE TYPE appraisal_status AS ENUM ('draft', 'self_appraisal', 'feedback_collection', 'manager_review', 'finalized', 'closed');
CREATE TYPE appraisal_rating AS ENUM ('exceeds', 'meets', 'partially_meets', 'does_not_meet');
CREATE TYPE feedback_req_status AS ENUM ('pending', 'submitted', 'declined');
CREATE TYPE audit_client     AS ENUM ('web', 'mobile', 'slack', 'system');

-- =============================================================================
-- USERS & ORG
-- =============================================================================

CREATE TABLE users (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             TEXT        NOT NULL UNIQUE,
  name              TEXT        NOT NULL,
  department        TEXT,
  team              TEXT,
  manager_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  role              user_role   NOT NULL DEFAULT 'member',
  auth_type         auth_type   NOT NULL DEFAULT 'google_sso',
  password_hash     TEXT,                           -- null for SSO users
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  slack_user_id     TEXT,
  google_directory_id TEXT,                         -- Google Workspace user ID
  last_synced_at    TIMESTAMPTZ,                    -- last Google Directory sync
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT password_required_for_email_auth
    CHECK (auth_type != 'email_password' OR password_hash IS NOT NULL)
);

CREATE INDEX idx_users_email      ON users(email);
CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_users_department ON users(department);
CREATE INDEX idx_users_team       ON users(team);

-- Pre-computed manager chain (closure table) — rebuilt nightly
CREATE TABLE user_hierarchy (
  ancestor_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  descendant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  depth         INT  NOT NULL CHECK (depth >= 0),
  PRIMARY KEY (ancestor_id, descendant_id)
);

CREATE INDEX idx_user_hierarchy_ancestor   ON user_hierarchy(ancestor_id);
CREATE INDEX idx_user_hierarchy_descendant ON user_hierarchy(descendant_id);

-- Password reset tokens
CREATE TABLE password_reset_tokens (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- CYCLES
-- =============================================================================

CREATE TABLE cycles (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT         NOT NULL,
  type                cycle_type   NOT NULL,
  start_date          DATE         NOT NULL,
  end_date            DATE         NOT NULL,
  status              cycle_status NOT NULL DEFAULT 'planning',
  department_override TEXT,        -- if set, this cycle is dept-specific
  team_override       TEXT,        -- if set, this cycle is team-specific
  created_by          UUID         NOT NULL REFERENCES users(id),
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT cycle_dates_valid CHECK (end_date > start_date)
);

CREATE INDEX idx_cycles_status ON cycles(status);

-- =============================================================================
-- OBJECTIVES
-- =============================================================================

CREATE TABLE objectives (
  id                   UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  title                TEXT             NOT NULL,
  description          TEXT,
  level                okr_level        NOT NULL,
  owner_id             UUID             NOT NULL REFERENCES users(id),
  department           TEXT,
  team                 TEXT,
  parent_objective_id  UUID             REFERENCES objectives(id) ON DELETE SET NULL,
  cycle_id             UUID             NOT NULL REFERENCES cycles(id),
  status               okr_status       NOT NULL DEFAULT 'draft',
  visibility           visibility_type  NOT NULL DEFAULT 'public',
  rejection_reason     TEXT,
  created_by           UUID             NOT NULL REFERENCES users(id),
  approved_by          UUID             REFERENCES users(id),
  approved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_objectives_owner_id  ON objectives(owner_id);
CREATE INDEX idx_objectives_cycle_id  ON objectives(cycle_id);
CREATE INDEX idx_objectives_status    ON objectives(status);
CREATE INDEX idx_objectives_level     ON objectives(level);
CREATE INDEX idx_objectives_dept      ON objectives(department);
CREATE INDEX idx_objectives_team      ON objectives(team);
CREATE INDEX idx_objectives_parent    ON objectives(parent_objective_id);
-- Full-text search
CREATE INDEX idx_objectives_title_trgm ON objectives USING GIN (title gin_trgm_ops);

-- =============================================================================
-- KEY RESULTS
-- =============================================================================

CREATE TABLE key_results (
  id              UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id    UUID             NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title           TEXT             NOT NULL,
  description     TEXT,
  owner_id        UUID             NOT NULL REFERENCES users(id),
  metric_type     metric_type      NOT NULL,
  start_value     NUMERIC          NOT NULL DEFAULT 0,
  target_value    NUMERIC          NOT NULL,
  current_value   NUMERIC          NOT NULL DEFAULT 0,
  unit            TEXT,
  confidence      confidence_level NOT NULL DEFAULT 'on_track',
  status          okr_status       NOT NULL DEFAULT 'active',
  created_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  last_checkin_at TIMESTAMPTZ,
  CONSTRAINT binary_values_valid
    CHECK (metric_type != 'binary' OR target_value IN (0, 1))
);

CREATE INDEX idx_key_results_objective_id ON key_results(objective_id);
CREATE INDEX idx_key_results_owner_id     ON key_results(owner_id);
CREATE INDEX idx_key_results_confidence   ON key_results(confidence);

-- =============================================================================
-- CHECK-INS
-- =============================================================================

CREATE TABLE checkins (
  id               UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id    UUID             NOT NULL REFERENCES key_results(id) ON DELETE CASCADE,
  author_id        UUID             NOT NULL REFERENCES users(id),
  previous_value   NUMERIC          NOT NULL,
  new_value        NUMERIC          NOT NULL,
  confidence       confidence_level NOT NULL,
  note             TEXT,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_checkins_key_result_id ON checkins(key_result_id);
CREATE INDEX idx_checkins_author_id     ON checkins(author_id);
CREATE INDEX idx_checkins_created_at    ON checkins(created_at DESC);

-- =============================================================================
-- ALIGNMENTS (explicit parent-child links across cycles)
-- =============================================================================

CREATE TABLE alignments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  child_objective_id   UUID        NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  parent_objective_id  UUID        NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  created_by           UUID        NOT NULL REFERENCES users(id),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (child_objective_id, parent_objective_id)
);

CREATE INDEX idx_alignments_child  ON alignments(child_objective_id);
CREATE INDEX idx_alignments_parent ON alignments(parent_objective_id);

-- =============================================================================
-- COLLABORATORS
-- =============================================================================

CREATE TABLE okr_collaborators (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id          UUID          NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  invited_by            UUID          NOT NULL REFERENCES users(id),
  collaborator_user_id  UUID          NOT NULL REFERENCES users(id),
  status                collab_status NOT NULL DEFAULT 'pending',
  invited_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  responded_at          TIMESTAMPTZ,
  UNIQUE (objective_id, collaborator_user_id)
);

CREATE INDEX idx_collaborators_objective_id ON okr_collaborators(objective_id);
CREATE INDEX idx_collaborators_user_id      ON okr_collaborators(collaborator_user_id);
CREATE INDEX idx_collaborators_status       ON okr_collaborators(status);

-- =============================================================================
-- REVIEW CYCLES
-- =============================================================================

CREATE TABLE review_cycles (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    UUID         NOT NULL REFERENCES cycles(id),
  name        TEXT         NOT NULL,
  review_date DATE         NOT NULL,
  scope       review_scope NOT NULL,
  department  TEXT,
  team        TEXT,
  created_by  UUID         NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE review_items (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  review_cycle_id UUID          NOT NULL REFERENCES review_cycles(id) ON DELETE CASCADE,
  objective_id    UUID          NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  reviewer_id     UUID          NOT NULL REFERENCES users(id),
  status          review_status NOT NULL DEFAULT 'pending',
  note            TEXT,
  submitted_at    TIMESTAMPTZ,
  reviewed_at     TIMESTAMPTZ,
  UNIQUE (review_cycle_id, objective_id, reviewer_id)
);

CREATE INDEX idx_review_items_reviewer ON review_items(reviewer_id);
CREATE INDEX idx_review_items_status   ON review_items(status);

-- =============================================================================
-- SMART+ SCORES
-- =============================================================================

CREATE TABLE okr_smart_scores (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id      UUID        NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  scored_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model_version     TEXT        NOT NULL,
  specific_score    SMALLINT    NOT NULL CHECK (specific_score BETWEEN 0 AND 10),
  measurable_score  SMALLINT    NOT NULL CHECK (measurable_score BETWEEN 0 AND 10),
  achievable_score  SMALLINT    NOT NULL CHECK (achievable_score BETWEEN 0 AND 10),
  relevant_score    SMALLINT    NOT NULL CHECK (relevant_score BETWEEN 0 AND 10),
  time_bound_score  SMALLINT    NOT NULL CHECK (time_bound_score BETWEEN 0 AND 10),
  overall_score     SMALLINT    NOT NULL CHECK (overall_score BETWEEN 0 AND 10),
  feedback          JSONB       NOT NULL,   -- { specific, measurable, achievable, relevant, timeBound, summary }
  raw_response      TEXT
);

CREATE INDEX idx_smart_scores_objective ON okr_smart_scores(objective_id);
-- Only one score per objective per day
CREATE UNIQUE INDEX idx_smart_scores_daily
  ON okr_smart_scores(objective_id, utc_date(scored_at));

-- =============================================================================
-- APPRAISALS
-- =============================================================================

CREATE TABLE appraisal_cycles (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT             NOT NULL,
  period_start DATE             NOT NULL,
  period_end   DATE             NOT NULL,
  status       appraisal_status NOT NULL DEFAULT 'draft',
  created_by   UUID             NOT NULL REFERENCES users(id),
  created_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  CONSTRAINT appraisal_dates_valid CHECK (period_end > period_start)
);

CREATE TABLE appraisal_records (
  id                         UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id                   UUID             NOT NULL REFERENCES appraisal_cycles(id),
  employee_id                UUID             NOT NULL REFERENCES users(id),
  manager_id                 UUID             NOT NULL REFERENCES users(id),
  self_appraisal_text        TEXT,
  self_submitted_at          TIMESTAMPTZ,
  manager_rating             appraisal_rating,
  manager_comments           TEXT,
  manager_finalized_at       TIMESTAMPTZ,
  overall_okr_achievement_pct NUMERIC         CHECK (overall_okr_achievement_pct BETWEEN 0 AND 100),
  created_at                 TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE (cycle_id, employee_id)
);

CREATE INDEX idx_appraisal_records_cycle    ON appraisal_records(cycle_id);
CREATE INDEX idx_appraisal_records_employee ON appraisal_records(employee_id);
CREATE INDEX idx_appraisal_records_manager  ON appraisal_records(manager_id);

CREATE TABLE appraisal_okr_comments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_record_id  UUID NOT NULL REFERENCES appraisal_records(id) ON DELETE CASCADE,
  objective_id         UUID NOT NULL REFERENCES objectives(id),
  employee_comment     TEXT,
  manager_comment      TEXT,
  UNIQUE (appraisal_record_id, objective_id)
);

CREATE TABLE appraisal_feedback_requests (
  id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  appraisal_record_id UUID                NOT NULL REFERENCES appraisal_records(id) ON DELETE CASCADE,
  requested_by        UUID                NOT NULL REFERENCES users(id),
  feedback_provider_id UUID               NOT NULL REFERENCES users(id),
  status              feedback_req_status NOT NULL DEFAULT 'pending',
  feedback_text       TEXT,
  submitted_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  UNIQUE (appraisal_record_id, feedback_provider_id)
);

CREATE INDEX idx_feedback_requests_provider ON appraisal_feedback_requests(feedback_provider_id);

-- =============================================================================
-- EMAIL INTELLIGENCE
-- =============================================================================

CREATE TABLE email_scraping_consent (
  user_id       UUID           PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  consent_level scrape_consent NOT NULL DEFAULT 'none',
  schedule      scrape_schedule NOT NULL DEFAULT 'manual',
  enabled_at    TIMESTAMPTZ,
  updated_at    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE email_scrape_jobs (
  id            UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID              NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  triggered_by  TEXT              NOT NULL CHECK (triggered_by IN ('manual', 'scheduled')),
  status        scrape_job_status NOT NULL DEFAULT 'pending',
  run_at        TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX idx_scrape_jobs_user_id ON email_scrape_jobs(user_id);
CREATE INDEX idx_scrape_jobs_status  ON email_scrape_jobs(status);

CREATE TABLE email_scrape_extractions (
  id                  UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id              UUID             NOT NULL REFERENCES email_scrape_jobs(id) ON DELETE CASCADE,
  gmail_message_id    TEXT             NOT NULL,
  extracted_text      TEXT             NOT NULL,
  proposed_update     JSONB            NOT NULL,  -- ProposedOkrUpdate shape
  user_decision       extract_decision NOT NULL DEFAULT 'pending',
  decided_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_extractions_job_id   ON email_scrape_extractions(job_id);
CREATE INDEX idx_extractions_decision ON email_scrape_extractions(user_decision);

-- Google OAuth tokens per user (for Gmail + Calendar APIs)
CREATE TABLE google_oauth_tokens (
  user_id       UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  scopes        TEXT[]      NOT NULL,
  access_token  TEXT        NOT NULL,   -- encrypted at app level
  refresh_token TEXT        NOT NULL,   -- encrypted at app level
  expires_at    TIMESTAMPTZ NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- BULK IMPORT
-- =============================================================================

CREATE TABLE bulk_import_jobs (
  id                UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID            NOT NULL REFERENCES users(id),
  job_type          bulk_job_type   NOT NULL,
  file_name         TEXT            NOT NULL,
  file_storage_path TEXT            NOT NULL,
  status            bulk_job_status NOT NULL DEFAULT 'pending',
  row_results       JSONB           NOT NULL DEFAULT '[]',
  total_rows        INT             NOT NULL DEFAULT 0,
  success_rows      INT             NOT NULL DEFAULT 0,
  error_rows        INT             NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  committed_at      TIMESTAMPTZ
);

CREATE INDEX idx_bulk_jobs_user_id ON bulk_import_jobs(user_id);
CREATE INDEX idx_bulk_jobs_status  ON bulk_import_jobs(status);

-- =============================================================================
-- NOTIFICATION PREFERENCES
-- =============================================================================

CREATE TABLE notification_prefs (
  user_id               UUID          PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  channel               notif_channel NOT NULL DEFAULT 'slack',
  checkin_reminders     BOOLEAN       NOT NULL DEFAULT TRUE,
  review_requests       BOOLEAN       NOT NULL DEFAULT TRUE,
  at_risk_alerts        BOOLEAN       NOT NULL DEFAULT TRUE,
  appraisal_updates     BOOLEAN       NOT NULL DEFAULT TRUE,
  collaborator_requests BOOLEAN       NOT NULL DEFAULT TRUE,
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- MEETING DIGEST (v2)
-- =============================================================================

CREATE TABLE meeting_digest_settings (
  user_id           UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  enabled           BOOLEAN     NOT NULL DEFAULT FALSE,
  lead_time_minutes INT         NOT NULL DEFAULT 60 CHECK (lead_time_minutes BETWEEN 15 AND 1440),
  calendar_id       TEXT,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- AI API CALL LOG (cost tracking)
-- =============================================================================

CREATE TABLE ai_api_calls (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  called_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  model          TEXT        NOT NULL,
  purpose        TEXT        NOT NULL,   -- 'smart_score' | 'email_extract'
  actor_id       UUID        REFERENCES users(id),
  entity_type    TEXT,
  entity_id      UUID,
  tokens_in      INT         NOT NULL DEFAULT 0,
  tokens_out     INT         NOT NULL DEFAULT 0,
  cost_usd_cents INT         NOT NULL DEFAULT 0,
  success        BOOLEAN     NOT NULL DEFAULT TRUE,
  error_message  TEXT
);

CREATE INDEX idx_ai_calls_called_at ON ai_api_calls(called_at DESC);
CREATE INDEX idx_ai_calls_purpose   ON ai_api_calls(purpose);

-- =============================================================================
-- AUDIT LOG (append-only, never updated)
-- =============================================================================

CREATE TABLE audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_id    UUID        REFERENCES users(id),
  action      TEXT        NOT NULL,
  entity_type TEXT        NOT NULL,
  entity_id   UUID,
  old_json    JSONB,
  new_json    JSONB,
  client      audit_client NOT NULL DEFAULT 'web'
);

CREATE INDEX idx_audit_log_timestamp   ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_actor_id    ON audit_log(actor_id);
CREATE INDEX idx_audit_log_entity      ON audit_log(entity_type, entity_id);

-- =============================================================================
-- AUTO-UPDATE updated_at via trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_objectives_updated_at
  BEFORE UPDATE ON objectives
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_key_results_updated_at
  BEFORE UPDATE ON key_results
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- REBUILD user_hierarchy FUNCTION
-- Called nightly by Cloud Scheduler and on manager assignment changes
-- =============================================================================

CREATE OR REPLACE FUNCTION rebuild_user_hierarchy()
RETURNS VOID AS $$
BEGIN
  DELETE FROM user_hierarchy;
  -- Self-references (depth 0)
  INSERT INTO user_hierarchy (ancestor_id, descendant_id, depth)
  SELECT id, id, 0 FROM users WHERE is_active = TRUE;
  -- Recursive manager chain
  INSERT INTO user_hierarchy (ancestor_id, descendant_id, depth)
  WITH RECURSIVE chain AS (
    SELECT id AS ancestor_id, id AS descendant_id, 0 AS depth
    FROM users WHERE is_active = TRUE
    UNION ALL
    SELECT c.ancestor_id, u.id, c.depth + 1
    FROM chain c
    JOIN users u ON u.manager_id = c.descendant_id
    WHERE c.depth < 10  -- safety cap; adjust for deep orgs
  )
  SELECT DISTINCT ancestor_id, descendant_id, depth
  FROM chain
  WHERE ancestor_id != descendant_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- GOOGLE SHEETS EXPORT VIEW
-- Used by nightly export job and on-demand download
-- =============================================================================

CREATE OR REPLACE VIEW v_okr_export AS
SELECT
  o.id                    AS objective_id,
  c.name                  AS cycle,
  o.level,
  o.title                 AS objective_title,
  o.description           AS objective_description,
  o.status                AS objective_status,
  o.visibility,
  ou.name                 AS owner_name,
  ou.email                AS owner_email,
  o.department,
  o.team,
  po.title                AS parent_objective_title,
  kr.id                   AS key_result_id,
  kr.title                AS key_result_title,
  kr.metric_type,
  kr.start_value,
  kr.target_value,
  kr.current_value,
  kr.unit,
  kr.confidence,
  CASE
    WHEN kr.target_value = kr.start_value THEN NULL
    ELSE ROUND(
      ((kr.current_value - kr.start_value) / NULLIF(kr.target_value - kr.start_value, 0)) * 100, 1
    )
  END                     AS progress_pct,
  kr.last_checkin_at,
  o.created_at,
  o.updated_at
FROM objectives o
JOIN cycles c ON c.id = o.cycle_id
JOIN users ou ON ou.id = o.owner_id
LEFT JOIN objectives po ON po.id = o.parent_objective_id
LEFT JOIN key_results kr ON kr.objective_id = o.id
WHERE o.status != 'deleted';

-- =============================================================================
-- SHEETS SYNC LOG
-- =============================================================================
CREATE TABLE IF NOT EXISTS sheets_sync_log (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  direction       TEXT        NOT NULL CHECK (direction IN ('export', 'import')),
  status          TEXT        NOT NULL CHECK (status IN ('running', 'success', 'failed')),
  rows_affected   INTEGER,
  error_message   TEXT,
  triggered_by    UUID        REFERENCES users(id) ON DELETE SET NULL,
  started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_sheets_sync_log_started ON sheets_sync_log(started_at DESC);
