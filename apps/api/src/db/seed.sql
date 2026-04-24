-- =============================================================================
-- Verve OKR Tool — Demo Seed Data
-- =============================================================================
-- Populates a realistic org with 12 users across 3 departments, two OKR cycles,
-- a full objective hierarchy, check-ins, an appraisal cycle, and a review cycle.
--
-- Safe to re-run: all inserts use ON CONFLICT DO NOTHING / ON CONFLICT (id) DO NOTHING.
--
-- Run with:
--   psql $DATABASE_URL -f apps/api/src/db/seed.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- USERS
-- 12 people: admin, 3 dept_leads, 3 team_leads, 5 members
-- =============================================================================

INSERT INTO users (id, email, name, department, team, role, auth_type) VALUES
  ('00000001-0000-0000-0000-000000000001', 'jayant.sharma@capillarytech.com',  'Jayant Sharma', NULL,          NULL,           'admin',     'google_sso'),
  ('00000001-0000-0000-0000-000000000002', 'priya.mehta@capillarytech.com',    'Priya Mehta',   'Engineering', NULL,           'dept_lead', 'google_sso'),
  ('00000001-0000-0000-0000-000000000003', 'arjun.kapoor@capillarytech.com',   'Arjun Kapoor',  'Engineering', 'Backend',      'team_lead', 'google_sso'),
  ('00000001-0000-0000-0000-000000000004', 'anjali.sharma@capillarytech.com',  'Anjali Sharma', 'Engineering', 'Frontend',     'team_lead', 'google_sso'),
  ('00000001-0000-0000-0000-000000000005', 'rahul.singh@capillarytech.com',    'Rahul Singh',   'Engineering', 'Backend',      'member',    'google_sso'),
  ('00000001-0000-0000-0000-000000000006', 'neha.joshi@capillarytech.com',     'Neha Joshi',    'Engineering', 'Backend',      'member',    'google_sso'),
  ('00000001-0000-0000-0000-000000000007', 'vikram.nair@capillarytech.com',    'Vikram Nair',   'Product',     NULL,           'dept_lead', 'google_sso'),
  ('00000001-0000-0000-0000-000000000008', 'deepa.reddy@capillarytech.com',    'Deepa Reddy',   'Product',     'Core Product', 'team_lead', 'google_sso'),
  ('00000001-0000-0000-0000-000000000009', 'aditya.kumar@capillarytech.com',   'Aditya Kumar',  'Product',     'Core Product', 'member',    'google_sso'),
  ('00000001-0000-0000-0000-000000000010', 'rajesh.iyer@capillarytech.com',    'Rajesh Iyer',   'Sales',       NULL,           'dept_lead', 'google_sso'),
  ('00000001-0000-0000-0000-000000000011', 'kavya.bhat@capillarytech.com',     'Kavya Bhat',    'Sales',       'Enterprise',   'member',    'google_sso'),
  ('00000001-0000-0000-0000-000000000012', 'sonia.patel@capillarytech.com',    'Sonia Patel',   'Product',     'Core Product', 'member',    'google_sso')
ON CONFLICT (email) DO NOTHING;

-- Manager relationships
UPDATE users SET manager_id = '00000001-0000-0000-0000-000000000001'
  WHERE email IN ('priya.mehta@capillarytech.com', 'vikram.nair@capillarytech.com', 'rajesh.iyer@capillarytech.com');

UPDATE users SET manager_id = '00000001-0000-0000-0000-000000000002'
  WHERE email IN ('arjun.kapoor@capillarytech.com', 'anjali.sharma@capillarytech.com');

UPDATE users SET manager_id = '00000001-0000-0000-0000-000000000003'
  WHERE email IN ('rahul.singh@capillarytech.com', 'neha.joshi@capillarytech.com');

UPDATE users SET manager_id = '00000001-0000-0000-0000-000000000007'
  WHERE email = 'deepa.reddy@capillarytech.com';

UPDATE users SET manager_id = '00000001-0000-0000-0000-000000000008'
  WHERE email IN ('aditya.kumar@capillarytech.com', 'sonia.patel@capillarytech.com');

UPDATE users SET manager_id = '00000001-0000-0000-0000-000000000010'
  WHERE email = 'kavya.bhat@capillarytech.com';

-- Rebuild manager closure table
SELECT rebuild_user_hierarchy();

-- =============================================================================
-- CYCLES
-- Q1 2026: just finished (review), Q2 2026: current (active)
-- =============================================================================

INSERT INTO cycles (id, name, type, start_date, end_date, status, created_by) VALUES
  ('00000002-0000-0000-0000-000000000001', 'FY2026 Q1', 'custom', '2026-01-01', '2026-03-31', 'review',  '00000001-0000-0000-0000-000000000001'),
  ('00000002-0000-0000-0000-000000000002', 'FY2026 Q2', 'custom', '2026-04-01', '2026-06-30', 'active',  '00000001-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- OBJECTIVES  (FY2026 Q2 — all active)
-- Hierarchy: Company → Department → Team → Individual
-- =============================================================================

-- ── Company ──────────────────────────────────────────────────────────────────
INSERT INTO objectives (id, title, description, level, owner_id, cycle_id, status, visibility, created_by) VALUES
(
  '00000003-0000-0000-0000-000000000001',
  'Achieve 25% revenue growth and expand to new enterprise segments',
  'Drive top-line growth by increasing enterprise ARR, winning new logos and improving net revenue retention. This is the north-star objective for Q2.',
  'company',
  '00000001-0000-0000-0000-000000000001',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- ── Department ───────────────────────────────────────────────────────────────
INSERT INTO objectives (id, title, description, level, owner_id, department, parent_objective_id, cycle_id, status, visibility, created_by) VALUES
(
  '00000003-0000-0000-0000-000000000002',
  'Deliver platform reliability and developer velocity to support 10x growth',
  'Ensure the engineering platform can scale with business growth by improving reliability, performance and CI/CD throughput.',
  'department',
  '00000001-0000-0000-0000-000000000002', 'Engineering',
  '00000003-0000-0000-0000-000000000001',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000002'
),
(
  '00000003-0000-0000-0000-000000000003',
  'Launch high-impact features that drive enterprise adoption and retention',
  'Ship the features that matter most to enterprise customers, measured by adoption rates and NPS improvement.',
  'department',
  '00000001-0000-0000-0000-000000000007', 'Product',
  '00000003-0000-0000-0000-000000000001',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000007'
),
(
  '00000003-0000-0000-0000-000000000004',
  'Exceed Q2 sales targets across enterprise and mid-market',
  'Close more deals, build a deeper pipeline and grow average deal size through better qualification and enterprise focus.',
  'department',
  '00000001-0000-0000-0000-000000000010', 'Sales',
  '00000003-0000-0000-0000-000000000001',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000010'
)
ON CONFLICT (id) DO NOTHING;

-- ── Team ─────────────────────────────────────────────────────────────────────
INSERT INTO objectives (id, title, description, level, owner_id, department, team, parent_objective_id, cycle_id, status, visibility, created_by) VALUES
(
  '00000003-0000-0000-0000-000000000005',
  'Re-architect core APIs to handle 10x load with sub-300ms p99 latency',
  'Refactor critical API paths, optimise database queries and expand caching to eliminate latency bottlenecks before the summer growth push.',
  'team',
  '00000001-0000-0000-0000-000000000003', 'Engineering', 'Backend',
  '00000003-0000-0000-0000-000000000002',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000003'
),
(
  '00000003-0000-0000-0000-000000000006',
  'Improve web app performance and eliminate customer-reported UI bugs',
  'Reduce load times and Lighthouse scores to industry best-practice levels while driving down UI bug rates across the product.',
  'team',
  '00000001-0000-0000-0000-000000000004', 'Engineering', 'Frontend',
  '00000003-0000-0000-0000-000000000002',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000004'
)
ON CONFLICT (id) DO NOTHING;

-- ── Individual ───────────────────────────────────────────────────────────────
INSERT INTO objectives (id, title, description, level, owner_id, department, team, parent_objective_id, cycle_id, status, visibility, created_by) VALUES
(
  '00000003-0000-0000-0000-000000000007',
  'Migrate legacy auth service to new microservice architecture',
  'Break the monolith authentication module into independently deployable services with full test coverage.',
  'individual',
  '00000001-0000-0000-0000-000000000005', 'Engineering', 'Backend',
  '00000003-0000-0000-0000-000000000005',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000005'
),
(
  '00000003-0000-0000-0000-000000000008',
  'Implement real-time event streaming pipeline for analytics',
  'Build and deploy a Kafka-based event pipeline capable of processing 50K events/sec with sub-100ms end-to-end latency.',
  'individual',
  '00000001-0000-0000-0000-000000000006', 'Engineering', 'Backend',
  '00000003-0000-0000-0000-000000000005',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000006'
),
(
  '00000003-0000-0000-0000-000000000009',
  'Build self-service analytics dashboard for enterprise customers',
  'Design and ship a configurable analytics dashboard that enterprise admins can set up without needing engineering involvement.',
  'individual',
  '00000001-0000-0000-0000-000000000009', 'Product', 'Core Product',
  '00000003-0000-0000-0000-000000000003',
  '00000002-0000-0000-0000-000000000002',
  'active', 'public',
  '00000001-0000-0000-0000-000000000009'
)
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- KEY RESULTS
-- 2–3 per objective, mix of on_track / at_risk / off_track
-- =============================================================================

INSERT INTO key_results (id, objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence) VALUES

-- Company (o1)
('00000004-0000-0000-0001-000000000001', '00000003-0000-0000-0000-000000000001',
 'Grow Enterprise ARR',                 '00000001-0000-0000-0000-000000000001',
 'currency',    8.0,   10.0,   8.4,  '$M',          'on_track'),
('00000004-0000-0000-0001-000000000002', '00000003-0000-0000-0000-000000000001',
 'Win new enterprise logos',            '00000001-0000-0000-0000-000000000001',
 'number',      45,    60,     48,   'logos',        'on_track'),
('00000004-0000-0000-0001-000000000003', '00000003-0000-0000-0000-000000000001',
 'Improve Net Revenue Retention',       '00000001-0000-0000-0000-000000000001',
 'percentage',  108,   115,    109,  '%',            'at_risk'),

-- Engineering dept (o2)
('00000004-0000-0000-0002-000000000001', '00000003-0000-0000-0000-000000000002',
 'Increase system uptime',              '00000001-0000-0000-0000-000000000002',
 'percentage',  99.5,  99.9,   99.7, '%',            'on_track'),
('00000004-0000-0000-0002-000000000002', '00000003-0000-0000-0000-000000000002',
 'Increase deployment frequency',       '00000001-0000-0000-0000-000000000002',
 'number',      2,     5,      3,    'deploys/week', 'on_track'),
('00000004-0000-0000-0002-000000000003', '00000003-0000-0000-0000-000000000002',
 'Reduce P95 API latency',              '00000001-0000-0000-0000-000000000002',
 'number',      450,   200,    380,  'ms',           'at_risk'),

-- Product dept (o3)
('00000004-0000-0000-0003-000000000001', '00000003-0000-0000-0000-000000000003',
 'Increase enterprise feature adoption', '00000001-0000-0000-0000-000000000007',
 'percentage',  20,    45,     26,   '%',            'on_track'),
('00000004-0000-0000-0003-000000000002', '00000003-0000-0000-0000-000000000003',
 'Ship enterprise-requested features',  '00000001-0000-0000-0000-000000000007',
 'number',      5,     15,     7,    'features',     'at_risk'),
('00000004-0000-0000-0003-000000000003', '00000003-0000-0000-0000-000000000003',
 'Improve NPS score',                   '00000001-0000-0000-0000-000000000007',
 'number',      32,    50,     36,   'NPS',          'on_track'),

-- Sales dept (o4)
('00000004-0000-0000-0004-000000000001', '00000003-0000-0000-0000-000000000004',
 'Close new enterprise deals',          '00000001-0000-0000-0000-000000000010',
 'number',      8,     20,     11,   'deals',        'on_track'),
('00000004-0000-0000-0004-000000000002', '00000003-0000-0000-0000-000000000004',
 'Build qualified pipeline coverage',   '00000001-0000-0000-0000-000000000010',
 'number',      2.0,   4.0,    2.8,  'x',            'on_track'),
('00000004-0000-0000-0004-000000000003', '00000003-0000-0000-0000-000000000004',
 'Grow average deal size',              '00000001-0000-0000-0000-000000000010',
 'currency',    180,   220,    188,  '$K',           'at_risk'),

-- Backend team (o5)
('00000004-0000-0000-0005-000000000001', '00000003-0000-0000-0000-000000000005',
 'Reduce API p99 latency',              '00000001-0000-0000-0000-000000000003',
 'number',      800,   300,    580,  'ms',           'on_track'),
('00000004-0000-0000-0005-000000000002', '00000003-0000-0000-0000-000000000005',
 'Reduce database query time',          '00000001-0000-0000-0000-000000000003',
 'number',      120,   40,     95,   'ms',           'on_track'),
('00000004-0000-0000-0005-000000000003', '00000003-0000-0000-0000-000000000005',
 'Improve cache hit rate',              '00000001-0000-0000-0000-000000000003',
 'percentage',  65,    90,     72,   '%',            'on_track'),

-- Frontend team (o6)
('00000004-0000-0000-0006-000000000001', '00000003-0000-0000-0000-000000000006',
 'Reduce page load time',               '00000001-0000-0000-0000-000000000004',
 'number',      3.2,   1.5,    2.8,  's',            'off_track'),
('00000004-0000-0000-0006-000000000002', '00000003-0000-0000-0000-000000000006',
 'Reduce UI bug reports per month',     '00000001-0000-0000-0000-000000000004',
 'number',      45,    10,     38,   'bugs/month',   'at_risk'),
('00000004-0000-0000-0006-000000000003', '00000003-0000-0000-0000-000000000006',
 'Improve Lighthouse performance score','00000001-0000-0000-0000-000000000004',
 'number',      68,    90,     73,   'score',        'on_track'),

-- Rahul — auth migration (o7)
('00000004-0000-0000-0007-000000000001', '00000003-0000-0000-0000-000000000007',
 'Complete auth microservice migrations','00000001-0000-0000-0000-000000000005',
 'number',      0,     5,      2,    'services',     'on_track'),
('00000004-0000-0000-0007-000000000002', '00000003-0000-0000-0000-000000000007',
 'Increase auth service test coverage', '00000001-0000-0000-0000-000000000005',
 'percentage',  42,    80,     55,   '%',            'on_track'),

-- Neha — event streaming (o8)
('00000004-0000-0000-0008-000000000001', '00000003-0000-0000-0000-000000000008',
 'Scale event processing throughput',   '00000001-0000-0000-0000-000000000006',
 'number',      1,     50,     12,   'K events/sec', 'at_risk'),
('00000004-0000-0000-0008-000000000002', '00000003-0000-0000-0000-000000000008',
 'Reduce event processing latency',     '00000001-0000-0000-0000-000000000006',
 'number',      500,   50,     320,  'ms',           'off_track'),

-- Aditya — dashboard (o9)
('00000004-0000-0000-0009-000000000001', '00000003-0000-0000-0000-000000000009',
 'Ship analytics dashboard modules',    '00000001-0000-0000-0000-000000000009',
 'number',      0,     6,      2,    'modules',      'on_track'),
('00000004-0000-0000-0009-000000000002', '00000003-0000-0000-0000-000000000009',
 'Reduce customer-reported dashboard issues', '00000001-0000-0000-0000-000000000009',
 'number',      5,     0,      2,    'issues',       'on_track')

ON CONFLICT (id) DO NOTHING;

-- Mark last check-in time on all seeded KRs
UPDATE key_results SET last_checkin_at = NOW() - INTERVAL '3 days'
WHERE id LIKE '00000004-%';

-- =============================================================================
-- CHECK-INS
-- Two rounds: Week 1 (Apr 7) and Week 3 (Apr 21) of Q2 2026
-- =============================================================================

INSERT INTO checkins (id, key_result_id, author_id, previous_value, new_value, confidence, note, created_at) VALUES

-- ── Week 1 (Apr 7) ───────────────────────────────────────────────────────────
('00000009-0001-0000-0000-000000000001',
 '00000004-0000-0000-0001-000000000001', '00000001-0000-0000-0000-000000000001',
 8.0, 8.2, 'on_track', 'Two enterprise expansions activated — Decathlon SEA and Levi''s APAC.',
 NOW() - INTERVAL '17 days'),

('00000009-0001-0000-0000-000000000002',
 '00000004-0000-0000-0001-000000000002', '00000001-0000-0000-0000-000000000001',
 45, 46, 'on_track', 'One new logo added — Decathlon SEA. Pipeline looks healthy.',
 NOW() - INTERVAL '17 days'),

('00000009-0001-0000-0000-000000000003',
 '00000004-0000-0000-0002-000000000001', '00000001-0000-0000-0000-000000000002',
 99.5, 99.65, 'on_track', 'Infra upgrades completed on 2 of 6 clusters. No incidents this week.',
 NOW() - INTERVAL '17 days'),

('00000009-0001-0000-0000-000000000004',
 '00000004-0000-0000-0002-000000000002', '00000001-0000-0000-0000-000000000002',
 2, 2, 'on_track', 'No change yet — new CI pipeline work kicks off next sprint.',
 NOW() - INTERVAL '17 days'),

('00000009-0001-0000-0000-000000000005',
 '00000004-0000-0000-0005-000000000001', '00000001-0000-0000-0000-000000000003',
 800, 680, 'on_track', 'Query profiling complete. Started rewriting the 3 highest-traffic endpoints.',
 NOW() - INTERVAL '17 days'),

('00000009-0001-0000-0000-000000000006',
 '00000004-0000-0000-0007-000000000001', '00000001-0000-0000-0000-000000000005',
 0, 1, 'on_track', 'Token service migrated and deployed to staging. All tests passing.',
 NOW() - INTERVAL '17 days'),

('00000009-0001-0000-0000-000000000007',
 '00000004-0000-0000-0008-000000000001', '00000001-0000-0000-0000-000000000006',
 1, 4, 'at_risk', 'Kafka cluster provisioned, basic pipeline working but throughput still low.',
 NOW() - INTERVAL '17 days'),

('00000009-0001-0000-0000-000000000008',
 '00000004-0000-0000-0009-000000000001', '00000001-0000-0000-0000-000000000009',
 0, 1, 'on_track', 'Overview module shipped to staging, collecting design feedback.',
 NOW() - INTERVAL '17 days'),

-- ── Week 3 (Apr 21) ──────────────────────────────────────────────────────────
('00000009-0003-0000-0000-000000000001',
 '00000004-0000-0000-0001-000000000001', '00000001-0000-0000-0000-000000000001',
 8.2, 8.4, 'on_track', 'Adidas expansion and Reliance Retail activated. Pace is good for $10M target.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000002',
 '00000004-0000-0000-0001-000000000002', '00000001-0000-0000-0000-000000000001',
 46, 48, 'on_track', '2 more logos closed — Puma APAC and Reliance Retail.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000003',
 '00000004-0000-0000-0001-000000000003', '00000001-0000-0000-0000-000000000001',
 108, 109, 'at_risk', 'NRR moving slowly. Churn from 2 SMB accounts offsets expansion revenue. Need to focus on retention.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000004',
 '00000004-0000-0000-0002-000000000001', '00000001-0000-0000-0000-000000000002',
 99.65, 99.7, 'on_track', '4 of 6 clusters upgraded. On track to reach 99.9% by end of quarter.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000005',
 '00000004-0000-0000-0002-000000000002', '00000001-0000-0000-0000-000000000002',
 2, 3, 'on_track', 'New CI pipeline live. Cut average deploy time from 22 min to 14 min.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000006',
 '00000004-0000-0000-0002-000000000003', '00000001-0000-0000-0000-000000000002',
 450, 380, 'at_risk', 'Latency improving but slower than expected. Auth service is the main bottleneck.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000007',
 '00000004-0000-0000-0003-000000000001', '00000001-0000-0000-0000-000000000007',
 20, 26, 'on_track', 'Analytics and SSO modules driving adoption among enterprise accounts.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000008',
 '00000004-0000-0000-0003-000000000002', '00000001-0000-0000-0000-000000000007',
 5, 7, 'at_risk', 'Bulk import and custom reports shipped. API integration feature still in design review.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000009',
 '00000004-0000-0000-0003-000000000003', '00000001-0000-0000-0000-000000000007',
 32, 36, 'on_track', 'Q2 NPS survey sent to 200 accounts — 140 responses received so far.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000010',
 '00000004-0000-0000-0004-000000000001', '00000001-0000-0000-0000-000000000010',
 8, 11, 'on_track', '3 enterprise deals closed this week — Myntra, Levi''s and Tanishq.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000011',
 '00000004-0000-0000-0004-000000000002', '00000001-0000-0000-0000-000000000010',
 2.0, 2.8, 'on_track', 'Pipeline growing well. 4 new qualified opps added from marketing events.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000012',
 '00000004-0000-0000-0004-000000000003', '00000001-0000-0000-0000-000000000010',
 180, 188, 'at_risk', 'Avg deal size creeping up but enterprise deals are taking longer to close.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000013',
 '00000004-0000-0000-0005-000000000001', '00000001-0000-0000-0000-000000000003',
 680, 580, 'on_track', 'Auth and search endpoints refactored. 3 more high-traffic endpoints in progress.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000014',
 '00000004-0000-0000-0005-000000000002', '00000001-0000-0000-0000-000000000003',
 120, 95, 'on_track', 'Added read replicas and query result caching. Big improvement on the reports endpoint.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000015',
 '00000004-0000-0000-0005-000000000003', '00000001-0000-0000-0000-000000000003',
 65, 72, 'on_track', 'Redis cache layer expanded to cover session and user profile lookups.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000016',
 '00000004-0000-0000-0006-000000000001', '00000001-0000-0000-0000-000000000004',
 3.2, 2.8, 'off_track', 'Bundle size barely reduced. Webpack config changes had side effects — reverted and retrying.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000017',
 '00000004-0000-0000-0006-000000000002', '00000001-0000-0000-0000-000000000004',
 45, 38, 'at_risk', '7 bugs fixed this sprint but a regression in the dashboard modal is slowing progress.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000018',
 '00000004-0000-0000-0006-000000000003', '00000001-0000-0000-0000-000000000004',
 68, 73, 'on_track', 'Image optimisation and lazy loading shipped. Score up 5 points.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000019',
 '00000004-0000-0000-0007-000000000001', '00000001-0000-0000-0000-000000000005',
 1, 2, 'on_track', 'Session service migrated and tested. OAuth service migration starts next sprint.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000020',
 '00000004-0000-0000-0007-000000000002', '00000001-0000-0000-0000-000000000005',
 42, 55, 'on_track', 'Unit tests added for token and session modules. Overall coverage now 55%.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000021',
 '00000004-0000-0000-0008-000000000001', '00000001-0000-0000-0000-000000000006',
 4, 12, 'at_risk', 'Throughput scaled to 12K eps after partition rebalancing. Still need 4x more — consumer lag is the issue.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000022',
 '00000004-0000-0000-0008-000000000002', '00000001-0000-0000-0000-000000000006',
 500, 320, 'off_track', 'Latency down but still far from 50ms target. Consumer backpressure needs architectural change.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000023',
 '00000004-0000-0000-0009-000000000001', '00000001-0000-0000-0000-000000000009',
 1, 2, 'on_track', 'Revenue breakdown module shipped to production. Funnel analytics in final review.',
 NOW() - INTERVAL '3 days'),

('00000009-0003-0000-0000-000000000024',
 '00000004-0000-0000-0009-000000000002', '00000001-0000-0000-0000-000000000009',
 5, 2, 'on_track', 'Fixed 3 critical issues raised by beta enterprise customers. Only 2 minor open bugs remain.',
 NOW() - INTERVAL '3 days')

ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- APPRAISAL CYCLE  (H1 2026 — currently in self-appraisal phase)
-- =============================================================================

INSERT INTO appraisal_cycles (id, name, period_start, period_end, status, created_by) VALUES
(
  '00000005-0000-0000-0000-000000000001',
  'H1 2026 Performance Review',
  '2026-01-01', '2026-06-30',
  'self_appraisal',
  '00000001-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Appraisal records for all ICs and team leads
INSERT INTO appraisal_records (id, cycle_id, employee_id, manager_id) VALUES
('00000006-0000-0000-0000-000000000001', '00000005-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000003'),  -- Rahul → Arjun
('00000006-0000-0000-0000-000000000002', '00000005-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000006', '00000001-0000-0000-0000-000000000003'),  -- Neha → Arjun
('00000006-0000-0000-0000-000000000003', '00000005-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000003', '00000001-0000-0000-0000-000000000002'),  -- Arjun → Priya
('00000006-0000-0000-0000-000000000004', '00000005-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000004', '00000001-0000-0000-0000-000000000002'),  -- Anjali → Priya
('00000006-0000-0000-0000-000000000005', '00000005-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000009', '00000001-0000-0000-0000-000000000008'),  -- Aditya → Deepa
('00000006-0000-0000-0000-000000000006', '00000005-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000012', '00000001-0000-0000-0000-000000000008'),  -- Sonia → Deepa
('00000006-0000-0000-0000-000000000007', '00000005-0000-0000-0000-000000000001', '00000001-0000-0000-0000-000000000011', '00000001-0000-0000-0000-000000000010')   -- Kavya → Rajesh
ON CONFLICT (cycle_id, employee_id) DO NOTHING;

-- Rahul has already submitted his self-appraisal
UPDATE appraisal_records
SET
  self_appraisal_text = 'In Q2 I have made strong progress on the auth service migration, completing 2 of 5 services ahead of schedule. I increased test coverage from 42% to 55% and unblocked the team by resolving a critical session management regression in week 2. I am on track to complete all 5 migrations by end of June and plan to start on the OAuth service next sprint.',
  self_submitted_at   = NOW() - INTERVAL '1 day'
WHERE id = '00000006-0000-0000-0000-000000000001';

-- =============================================================================
-- REVIEW CYCLE  (Q2 mid-quarter Engineering review, scheduled May 15)
-- =============================================================================

INSERT INTO review_cycles (id, cycle_id, name, review_date, scope, department, created_by) VALUES
(
  '00000007-0000-0000-0000-000000000001',
  '00000002-0000-0000-0000-000000000002',
  'Q2 2026 Mid-Quarter Engineering Review',
  '2026-05-15',
  'department', 'Engineering',
  '00000001-0000-0000-0000-000000000002'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO review_items (review_cycle_id, objective_id, reviewer_id) VALUES
('00000007-0000-0000-0000-000000000001', '00000003-0000-0000-0000-000000000002', '00000001-0000-0000-0000-000000000001'),  -- company Eng obj → Jayant
('00000007-0000-0000-0000-000000000001', '00000003-0000-0000-0000-000000000005', '00000001-0000-0000-0000-000000000002'),  -- Backend team obj → Priya
('00000007-0000-0000-0000-000000000001', '00000003-0000-0000-0000-000000000006', '00000001-0000-0000-0000-000000000002')   -- Frontend team obj → Priya
ON CONFLICT (review_cycle_id, objective_id, reviewer_id) DO NOTHING;

COMMIT;

SELECT 'Seed completed — 12 users, 2 cycles, 9 objectives, 24 KRs, 32 check-ins.' AS result;
