/**
 * Seed script — realistic demo data for local development.
 * Run: npx tsx src/db/seed.ts
 */
import 'dotenv/config'
import bcrypt from 'bcrypt'
import { pool, query, withTransaction } from './client.js'

async function seed() {
  console.log('🌱 Seeding database...')
  // Generate a shared password hash for all dev users (password: "password123")
  const devPasswordHash = await bcrypt.hash('password123', 12)

  await withTransaction(async (client) => {
    // ── Clean slate ──────────────────────────────────────────────────────────
    await client.query(`
      TRUNCATE checkins, okr_smart_scores, key_results, alignments,
        okr_collaborators, review_items, review_cycles,
        objectives, cycles, notification_prefs,
        user_hierarchy, users
      RESTART IDENTITY CASCADE
    `)

    // ── Users ────────────────────────────────────────────────────────────────
    const { rows: users } = await client.query(
      `INSERT INTO users (email, name, department, team, role, auth_type, password_hash) VALUES
        ('admin@capillary.com',      'Dev Admin',        'Corporate',         NULL,              'admin',     'email_password', $1),
        ('ceo@capillary.com',        'Sameer Nair',      'Corporate',         NULL,              'admin',     'email_password', $1),
        ('cto@capillary.com',        'Priya Mehta',      'Tech',              NULL,              'dept_lead', 'email_password', $1),
        ('vp.product@capillary.com', 'Arjun Sharma',     'Product',           NULL,              'dept_lead', 'email_password', $1),
        ('vp.cs@capillary.com',      'Divya Nair',       'Customer Success',  NULL,              'dept_lead', 'email_password', $1),
        ('vp.sales@capillary.com',   'Ravi Kumar',       'Sales',             NULL,              'dept_lead', 'email_password', $1),
        ('tl.platform@capillary.com','Ananya Rao',       'Tech',              'Platform',        'team_lead', 'email_password', $1),
        ('tl.mobile@capillary.com',  'Karan Patel',      'Tech',              'Mobile',          'team_lead', 'email_password', $1),
        ('pm.loyalty@capillary.com', 'Shreya Iyer',      'Product',           'Loyalty',         'team_lead', 'email_password', $1),
        ('pm.engage@capillary.com',  'Nikhil Joshi',     'Product',           'Engage',          'team_lead', 'email_password', $1),
        ('eng1@capillary.com',       'Aditya Singh',     'Tech',              'Platform',        'member',    'email_password', $1),
        ('eng2@capillary.com',       'Meera Krishnan',   'Tech',              'Mobile',          'member',    'email_password', $1),
        ('cs1@capillary.com',        'Rohan Desai',      'Customer Success',  'Enterprise',      'member',    'email_password', $1),
        ('sales1@capillary.com',     'Pooja Gupta',      'Sales',             'APAC',            'member',    'email_password', $1)
      RETURNING id, email, name, role`,
      [devPasswordHash],
    )

    const u = Object.fromEntries(users.map((r: any) => [r.email, r.id]))

    // Set manager relationships
    await client.query(`UPDATE users SET manager_id = $1 WHERE email IN ('vp.product@capillary.com','cto@capillary.com','vp.cs@capillary.com','vp.sales@capillary.com')`, [u['ceo@capillary.com']])
    await client.query(`UPDATE users SET manager_id = $1 WHERE email IN ('tl.platform@capillary.com','tl.mobile@capillary.com')`, [u['cto@capillary.com']])
    await client.query(`UPDATE users SET manager_id = $1 WHERE email IN ('pm.loyalty@capillary.com','pm.engage@capillary.com')`, [u['vp.product@capillary.com']])
    await client.query(`UPDATE users SET manager_id = $1 WHERE email = 'eng1@capillary.com'`, [u['tl.platform@capillary.com']])
    await client.query(`UPDATE users SET manager_id = $1 WHERE email = 'eng2@capillary.com'`, [u['tl.mobile@capillary.com']])
    await client.query(`UPDATE users SET manager_id = $1 WHERE email = 'cs1@capillary.com'`, [u['vp.cs@capillary.com']])
    await client.query(`UPDATE users SET manager_id = $1 WHERE email = 'sales1@capillary.com'`, [u['vp.sales@capillary.com']])

    // Notification prefs for all users
    for (const userId of Object.values(u)) {
      await client.query(
        `INSERT INTO notification_prefs (user_id, channel) VALUES ($1, 'slack') ON CONFLICT DO NOTHING`,
        [userId],
      )
    }

    // ── Rebuild hierarchy ────────────────────────────────────────────────────
    await client.query(`SELECT rebuild_user_hierarchy()`)

    // ── Cycle ────────────────────────────────────────────────────────────────
    const { rows: [cycle] } = await client.query(`
      INSERT INTO cycles (name, type, start_date, end_date, status, created_by)
      VALUES ('FY 2026', 'annual', '2026-01-01', '2026-12-31', 'active', $1)
      RETURNING id
    `, [u['ceo@capillary.com']])
    const cycleId = cycle.id

    // ── Company OKRs ─────────────────────────────────────────────────────────
    const { rows: [compObj1] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, cycle_id, status, visibility, created_by, approved_by, approved_at)
      VALUES (
        'Become the #1 loyalty platform in APAC by revenue',
        'Drive ARR growth to $120M by winning enterprise deals across SEA, India, and ANZ markets.',
        'company', $1, $2, 'active', 'public', $1, $1, NOW()
      ) RETURNING id
    `, [u['ceo@capillary.com'], cycleId])

    const { rows: [compObj2] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, cycle_id, status, visibility, created_by, approved_by, approved_at)
      VALUES (
        'Achieve world-class customer retention and NPS',
        'Ensure our existing customers are deeply successful, renew at >95%, and actively refer us.',
        'company', $1, $2, 'active', 'public', $1, $1, NOW()
      ) RETURNING id
    `, [u['ceo@capillary.com'], cycleId])

    // ── Department OKRs ──────────────────────────────────────────────────────
    const { rows: [techObj1] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, cycle_id, status, visibility, created_by, approved_by, approved_at, parent_objective_id)
      VALUES (
        'Ship a platform that scales to 500M loyalty events/day',
        'Re-architect the event ingestion pipeline to handle 10x current load with <50ms p99 latency.',
        'department', $1, 'Tech', $2, 'active', 'public', $1, $1, NOW(), $3
      ) RETURNING id
    `, [u['cto@capillary.com'], cycleId, compObj1.id])

    const { rows: [productObj1] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, cycle_id, status, visibility, created_by, approved_by, approved_at, parent_objective_id)
      VALUES (
        'Launch 3 high-impact features that drive measurable upsell',
        'Deliver AI-powered personalisation, tier gamification, and partner ecosystem modules.',
        'department', $1, 'Product', $2, 'active', 'public', $1, $1, NOW(), $3
      ) RETURNING id
    `, [u['vp.product@capillary.com'], cycleId, compObj1.id])

    const { rows: [csObj1] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, cycle_id, status, visibility, created_by, approved_by, approved_at, parent_objective_id)
      VALUES (
        'Drive customer health score above 80 across all accounts',
        'Proactively manage at-risk accounts and drive product adoption to reduce churn risk.',
        'department', $1, 'Customer Success', $2, 'active', 'public', $1, $1, NOW(), $3
      ) RETURNING id
    `, [u['vp.cs@capillary.com'], cycleId, compObj2.id])

    const { rows: [salesObj1] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, cycle_id, status, visibility, created_by, approved_by, approved_at, parent_objective_id)
      VALUES (
        'Close $45M in new ARR through enterprise and mid-market',
        'Win 20 new logos in APAC and expand 15 existing accounts to new business units.',
        'department', $1, 'Sales', $2, 'active', 'public', $1, $1, NOW(), $3
      ) RETURNING id
    `, [u['vp.sales@capillary.com'], cycleId, compObj1.id])

    // ── Team OKRs ────────────────────────────────────────────────────────────
    const { rows: [platformTeamObj] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, team, cycle_id, status, visibility, created_by, approved_by, approved_at, parent_objective_id)
      VALUES (
        'Rebuild event ingestion pipeline for 10x throughput',
        'Migrate from monolith to Kafka-based async pipeline. Target: 500M events/day, p99 < 50ms.',
        'team', $1, 'Tech', 'Platform', $2, 'active', 'public', $1, $1, NOW(), $3
      ) RETURNING id
    `, [u['tl.platform@capillary.com'], cycleId, techObj1.id])

    const { rows: [mobileTeamObj] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, team, cycle_id, status, visibility, created_by, approved_by, approved_at, parent_objective_id)
      VALUES (
        'Launch redesigned mobile SDK with 99.9% crash-free rate',
        'Rewrite the loyalty mobile SDK in Kotlin/Swift, reduce size by 40%, and achieve Play Store rating > 4.5.',
        'team', $1, 'Tech', 'Mobile', $2, 'active', 'public', $1, $1, NOW(), $3
      ) RETURNING id
    `, [u['tl.mobile@capillary.com'], cycleId, techObj1.id])

    const { rows: [loyaltyPMObj] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, team, cycle_id, status, visibility, created_by, approved_by, approved_at, parent_objective_id)
      VALUES (
        'Ship AI Personalisation module to GA by Q2',
        'Move from beta (3 customers) to GA with full self-serve onboarding and proven lift metrics.',
        'team', $1, 'Product', 'Loyalty', $2, 'active', 'public', $1, $1, NOW(), $3
      ) RETURNING id
    `, [u['pm.loyalty@capillary.com'], cycleId, productObj1.id])

    // ── Individual OKR (pending approval) ────────────────────────────────────
    const { rows: [indivObj] } = await client.query(`
      INSERT INTO objectives (title, description, level, owner_id, department, team, cycle_id, status, visibility, created_by, parent_objective_id)
      VALUES (
        'Improve Kafka consumer throughput by 3x this quarter',
        'Profile and optimise the consumer group configuration to reduce lag during peak traffic.',
        'individual', $1, 'Tech', 'Platform', $2, 'pending_approval', 'public', $1, $3
      ) RETURNING id
    `, [u['eng1@capillary.com'], cycleId, platformTeamObj.id])

    // ── Key Results ──────────────────────────────────────────────────────────
    // Company OKR 1 KRs
    const { rows: [kr1] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Grow ARR to $120M', $2, 'currency', 78, 120, 91, 'M USD', 'on_track') RETURNING id
    `, [compObj1.id, u['ceo@capillary.com']])

    const { rows: [kr2] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Win 20 new enterprise logos', $2, 'number', 0, 20, 11, 'logos', 'on_track') RETURNING id
    `, [compObj1.id, u['vp.sales@capillary.com']])

    const { rows: [kr3] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Achieve Net Revenue Retention > 120%', $2, 'percentage', 108, 120, 113, NULL, 'at_risk') RETURNING id
    `, [compObj1.id, u['vp.cs@capillary.com']])

    // Company OKR 2 KRs
    const { rows: [kr4] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Customer NPS > 55', $2, 'number', 38, 55, 47, 'NPS score', 'at_risk') RETURNING id
    `, [compObj2.id, u['vp.cs@capillary.com']])

    const { rows: [kr5] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Gross Revenue Retention > 95%', $2, 'percentage', 91, 95, 93, NULL, 'on_track') RETURNING id
    `, [compObj2.id, u['vp.cs@capillary.com']])

    // Tech OKR KRs
    const { rows: [kr6] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Event ingestion throughput to 500M/day', $2, 'number', 50, 500, 180, 'M events/day', 'at_risk') RETURNING id
    `, [techObj1.id, u['tl.platform@capillary.com']])

    const { rows: [kr7] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'p99 API latency below 50ms', $2, 'number', 210, 50, 95, 'ms', 'at_risk') RETURNING id
    `, [techObj1.id, u['cto@capillary.com']])

    const { rows: [kr8] } = await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Platform uptime SLA > 99.9%', $2, 'percentage', 99.2, 99.9, 99.7, NULL, 'on_track') RETURNING id
    `, [techObj1.id, u['cto@capillary.com']])

    // Platform team KRs
    await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES
        ($1, 'Migrate 100% of event consumers to Kafka', $2, 'percentage', 0, 100, 62, NULL, 'on_track'),
        ($1, 'Reduce Kafka consumer lag to < 5s at peak', $2, 'number', 45, 5, 12, 'seconds', 'at_risk')
    `, [platformTeamObj.id, u['tl.platform@capillary.com']])

    // Mobile team KRs
    await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES
        ($1, 'SDK crash-free rate > 99.9%', $2, 'percentage', 98.1, 99.9, 99.6, NULL, 'on_track'),
        ($1, 'Reduce SDK bundle size by 40%', $2, 'percentage', 0, 40, 28, NULL, 'on_track'),
        ($1, 'Play Store rating > 4.5', $2, 'number', 3.9, 4.5, 4.3, 'stars', 'at_risk')
    `, [mobileTeamObj.id, u['tl.mobile@capillary.com']])

    // Sales OKR KRs
    await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES
        ($1, 'Close $45M new ARR', $2, 'currency', 0, 45, 21, 'M USD', 'on_track'),
        ($1, 'Pipeline coverage ratio > 3x', $2, 'number', 1.8, 3, 2.6, 'x', 'on_track'),
        ($1, 'Win rate on enterprise deals > 35%', $2, 'percentage', 22, 35, 29, NULL, 'at_risk')
    `, [salesObj1.id, u['vp.sales@capillary.com']])

    // CS OKR KRs
    await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES
        ($1, 'Average health score > 80 across all accounts', $2, 'number', 64, 80, 72, 'score', 'at_risk'),
        ($1, 'Reduce time-to-value for new customers to < 45 days', $2, 'number', 90, 45, 58, 'days', 'at_risk'),
        ($1, 'Zero unmanaged churn in enterprise tier', $2, 'binary', 0, 1, 0, NULL, 'on_track')
    `, [csObj1.id, u['vp.cs@capillary.com']])

    // Product OKR KRs
    await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES
        ($1, 'AI Personalisation GA with 10+ customers live', $2, 'number', 3, 10, 7, 'customers', 'on_track'),
        ($1, 'Tier Gamification shipped and in 5 pilots', $2, 'number', 0, 5, 2, 'pilots', 'at_risk'),
        ($1, 'Feature NPS > 45 on new modules', $2, 'number', 0, 45, 38, 'NPS', 'on_track')
    `, [productObj1.id, u['vp.product@capillary.com']])

    // Individual OKR KR
    await client.query(`
      INSERT INTO key_results (objective_id, title, owner_id, metric_type, start_value, target_value, current_value, unit, confidence)
      VALUES ($1, 'Kafka consumer throughput from 60k to 180k msg/sec', $2, 'number', 60000, 180000, 95000, 'msg/sec', 'on_track')
    `, [indivObj.id, u['eng1@capillary.com']])

    // ── Check-ins ────────────────────────────────────────────────────────────
    // ARR KR check-ins
    for (const [prev, curr, conf, note, daysAgo] of [
      [78, 83, 'on_track', 'Strong Q1 close. Closed 3 enterprise deals in APAC.', 90],
      [83, 87, 'on_track', 'Two more logos closed in March. Pipeline looking healthy for Q2.', 60],
      [87, 91, 'on_track', 'Zenith and RetailMax closed. On track for Q2 target of $95M.', 14],
    ] as const) {
      await client.query(`
        INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW() - INTERVAL '${daysAgo} days')
      `, [kr1.id, u['ceo@capillary.com'], prev, curr, conf, note])
    }

    // NPS check-in
    await client.query(`
      INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note, created_at)
      VALUES ($1, $2, 38, 43, 'at_risk', 'NPS survey done — 43. Below target pace. Onboarding friction cited as top issue.', NOW() - INTERVAL '30 days')
    `, [kr4.id, u['vp.cs@capillary.com']])
    await client.query(`
      INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note, created_at)
      VALUES ($1, $2, 43, 47, 'at_risk', 'Slight improvement after support SLA changes. Still below trajectory.', NOW() - INTERVAL '7 days')
    `, [kr4.id, u['vp.cs@capillary.com']])

    // Platform throughput check-in
    await client.query(`
      INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note, created_at)
      VALUES ($1, $2, 50, 120, 'on_track', 'Phase 1 Kafka migration complete. 3 consumer groups migrated.', NOW() - INTERVAL '60 days')
    `, [kr6.id, u['tl.platform@capillary.com']])
    await client.query(`
      INSERT INTO checkins (key_result_id, author_id, previous_value, new_value, confidence, note, created_at)
      VALUES ($1, $2, 120, 180, 'at_risk', 'Hitting bottleneck at serialisation layer. Need 2 more weeks to resolve.', NOW() - INTERVAL '14 days')
    `, [kr6.id, u['tl.platform@capillary.com']])

    // ── SMART+ Scores ────────────────────────────────────────────────────────
    const smartScoreData = [
      [compObj1.id, 9, 9, 7, 9, 8, 9, 'Very specific revenue target with clear market scope.', 'ARR and logo count are objectively measurable.', 'Ambitious but grounded in market data.', 'Directly tied to company growth strategy.', 'Annual cycle with quarterly milestones.', 'Excellent OKR — specific, data-driven, and well-aligned to company strategy.'],
      [compObj2.id, 8, 8, 8, 9, 7, 8, 'Clear focus on retention and NPS.', 'NPS and GRR are standard measurable metrics.', 'Achievable based on current trajectory.', 'Retention is foundational to SaaS growth.', 'Could benefit from quarterly milestones.', 'Strong customer-success OKR with clear metrics.'],
      [techObj1.id, 9, 9, 6, 8, 8, 8, 'Highly specific technical target.', 'Events/day and latency are precise metrics.', 'Aggressive — 10x scale in one year is challenging.', 'Platform scalability directly enables revenue growth.', 'Annual scope with Q-by-Q delivery plan needed.', 'Technically strong OKR. Achievability should be reviewed with the engineering team.'],
      [platformTeamObj.id, 9, 9, 8, 8, 8, 9, 'Kafka migration with clear completion criteria.', 'Percentage migrated and latency are measurable.', 'Realistic based on team velocity.', 'Directly supports company platform goals.', 'Quarterly delivery makes it time-bound.', 'Well-crafted team OKR with clear technical deliverables.'],
      [loyaltyPMObj.id, 8, 8, 7, 9, 9, 8, 'GA milestone is a clear specific target.', 'Customer count is measurable.', 'Beta to GA is a meaningful but achievable step.', 'AI Personalisation is a key upsell driver.', 'Q2 deadline is explicit and time-bound.', 'Good product OKR. Consider adding lift metrics to strengthen measurability.'],
    ]

    for (const [objId, sp, me, ac, re, tb, ov, sf, mf, af, rf, tf, sum] of smartScoreData) {
      await client.query(`
        INSERT INTO okr_smart_scores
          (objective_id, model_version, specific_score, measurable_score, achievable_score,
           relevant_score, time_bound_score, overall_score, feedback)
        VALUES ($1, 'claude-opus-4-6', $2, $3, $4, $5, $6, $7, $8)
      `, [objId, sp, me, ac, re, tb, ov, JSON.stringify({
        specific: sf, measurable: mf, achievable: af, relevant: rf, timeBound: tf, summary: sum
      })])
    }

    // ── Alignments ───────────────────────────────────────────────────────────
    for (const [child, parent] of [
      [techObj1.id, compObj1.id],
      [productObj1.id, compObj1.id],
      [salesObj1.id, compObj1.id],
      [csObj1.id, compObj2.id],
      [platformTeamObj.id, techObj1.id],
      [mobileTeamObj.id, techObj1.id],
      [loyaltyPMObj.id, productObj1.id],
    ]) {
      await client.query(`
        INSERT INTO alignments (child_objective_id, parent_objective_id, created_by)
        VALUES ($1, $2, $3) ON CONFLICT DO NOTHING
      `, [child, parent, u['ceo@capillary.com']])
    }

    // ── Review cycle ─────────────────────────────────────────────────────────
    await client.query(`
      INSERT INTO review_cycles (cycle_id, name, review_date, scope, created_by)
      VALUES ($1, 'Q1 2026 Review', '2026-04-15', 'company', $2)
    `, [cycleId, u['ceo@capillary.com']])

    console.log('✅ Seed complete!')
    console.log('')
    console.log('Demo users (all use email/password login):')
    console.log('  CEO:        ceo@capillary.com')
    console.log('  CTO:        cto@capillary.com')
    console.log('  VP Product: vp.product@capillary.com')
    console.log('  VP CS:      vp.cs@capillary.com')
    console.log('  VP Sales:   vp.sales@capillary.com')
    console.log('  Team Lead:  tl.platform@capillary.com')
    console.log('  Engineer:   eng1@capillary.com')
    console.log('  (Password auth is mocked in seed — use /auth/login in dev)')
  })
}

seed().finally(() => pool.end())
