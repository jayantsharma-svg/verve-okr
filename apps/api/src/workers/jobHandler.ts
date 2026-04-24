/**
 * Central job dispatcher — called by Cloud Tasks HTTP endpoint.
 * Each handler is isolated so failures don't cascade.
 */
import { scoreObjective } from './smartScore.js'
import { runEmailScrape, runScheduledEmailScrapes } from './emailScrape.js'
import { processBulkImport } from './bulkImport.js'
import { rebuildUserHierarchy, syncGoogleDirectory } from './orgSync.js'
import { exportToSheets } from './sheetsExport.js'
import { importFromSheets } from './sheetsImport.js'
import { sendNotification } from '../services/notifications.js'
import { runMeetingDigest, runAllDigests } from './meetingDigest.js'
import { sendCheckinReminders } from './checkinReminder.js'

export async function handleJob(type: string, payload: unknown): Promise<void> {
  switch (type) {
    case 'smart_score':
      await scoreObjective((payload as { objectiveId: string }).objectiveId)
      break
    case 'email_scrape':
      await runEmailScrape(payload as { userId: string; triggeredBy: string })
      break
    case 'bulk_process':
      await processBulkImport((payload as { jobId: string }).jobId)
      break
    case 'hierarchy_rebuild':
      await rebuildUserHierarchy()
      break
    case 'org_sync':
      await syncGoogleDirectory()
      break
    case 'sheets_export':
      await exportToSheets(payload as { exportId?: string })
      break
    case 'sheets_import':
      await importFromSheets({ triggeredBy: (payload as any)?.triggeredBy })
      break
    case 'notification':
      await sendNotification(payload as { userId: string; type: string; data: Record<string, unknown> })
      break
    case 'meeting_digest':
      await runAllDigests()
      break
    case 'meeting_digest_user':
      await runMeetingDigest({ userId: (payload as { userId: string }).userId })
      break
    case 'checkin_reminder':
      await sendCheckinReminders()
      break
    case 'scheduled_email_scrape':
      await runScheduledEmailScrapes()
      break
    default:
      console.warn(`[JobHandler] Unknown job type: ${type}`)
  }
}
