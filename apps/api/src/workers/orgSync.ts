/**
 * Rebuilds the user_hierarchy closure table and syncs org data from Google Directory.
 * Called nightly via Cloud Scheduler.
 */
import { google } from 'googleapis'
import { query, queryOne, withTransaction } from '../db/client.js'

export async function rebuildUserHierarchy(): Promise<void> {
  console.log('[OrgSync] Rebuilding user_hierarchy...')
  await query('SELECT rebuild_user_hierarchy()')
  console.log('[OrgSync] user_hierarchy rebuilt.')
}

export async function syncGoogleDirectory(): Promise<void> {
  console.log('[OrgSync] Syncing Google Directory...')

  const keyBase64 = process.env['GOOGLE_SERVICE_ACCOUNT_KEY_BASE64']
  if (!keyBase64) {
    console.warn('[OrgSync] GOOGLE_SERVICE_ACCOUNT_KEY_BASE64 not set — skipping Directory sync.')
    return
  }

  const keyJson = JSON.parse(Buffer.from(keyBase64, 'base64').toString('utf8'))

  const auth = new google.auth.GoogleAuth({
    credentials: keyJson,
    scopes: ['https://www.googleapis.com/auth/admin.directory.user.readonly'],
  })

  const admin = google.admin({ version: 'directory_v1', auth })
  let pageToken: string | undefined

  interface DirectoryUser {
    email: string
    name: string
    department: string | null
    team: string | null
    isActive: boolean
    managerEmail: string | null
    googleDirectoryId: string | null
  }

  const dirUsers: DirectoryUser[] = []

  do {
    const res = await admin.users.list({
      customer: 'my_customer',
      maxResults: 200,
      pageToken,
      projection: 'full',
      orderBy: 'email',
    })

    for (const u of res.data.users ?? []) {
      if (!u.primaryEmail) continue

      // Extract department and team from organizations array
      const org = u.organizations?.[0]
      const department = org?.department ?? null
      // Use costCenter or the org's name as team if present
      const team = org?.costCenter ?? null

      // Manager email from relations (type = 'manager')
      const managerEmail = u.relations?.find((r: any) => r.type === 'manager')?.value ?? null

      dirUsers.push({
        email: u.primaryEmail,
        name: u.name?.fullName ?? u.primaryEmail,
        department,
        team,
        isActive: !u.suspended,
        managerEmail,
        googleDirectoryId: u.id ?? null,
      })
    }

    pageToken = res.data.nextPageToken ?? undefined
  } while (pageToken)

  // Phase 1: upsert all users (without manager_id — resolving emails first)
  await withTransaction(async (client) => {
    for (const u of dirUsers) {
      await client.query(
        `INSERT INTO users (email, name, department, team, is_active, google_directory_id, last_synced_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (email) DO UPDATE SET
           name                = EXCLUDED.name,
           department          = EXCLUDED.department,
           team                = EXCLUDED.team,
           is_active           = EXCLUDED.is_active,
           google_directory_id = EXCLUDED.google_directory_id,
           last_synced_at      = NOW()`,
        [u.email, u.name, u.department, u.team, u.isActive, u.googleDirectoryId],
      )
    }
  })

  // Phase 2: resolve manager emails → manager_ids
  const managersToUpdate = dirUsers.filter(u => u.managerEmail)
  if (managersToUpdate.length > 0) {
    await withTransaction(async (client) => {
      for (const u of managersToUpdate) {
        const mgr = await queryOne<{ id: string }>(
          'SELECT id FROM users WHERE email = $1',
          [u.managerEmail],
        )
        if (!mgr) continue
        await client.query(
          'UPDATE users SET manager_id = $1 WHERE email = $2',
          [mgr.id, u.email],
        )
      }
    })
  }

  // Phase 3: rebuild hierarchy closure table
  await rebuildUserHierarchy()

  console.log(`[OrgSync] Synced ${dirUsers.length} users from Google Directory (${managersToUpdate.length} manager links resolved).`)
}
