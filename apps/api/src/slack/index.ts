import bolt from '@slack/bolt'
const { App, ExpressReceiver } = bolt
import { registerCommands } from './commands.js'
import { registerActions } from './actions.js'

export function initSlack(expressApp: import('express').Application): App | null {
  const token         = process.env['SLACK_BOT_TOKEN']
  const signingSecret = process.env['SLACK_SIGNING_SECRET']
  const appToken      = process.env['SLACK_APP_TOKEN']

  if (!token || !signingSecret) {
    console.log('[Slack] SLACK_BOT_TOKEN or SLACK_SIGNING_SECRET not set — Slack bot disabled')
    return null
  }

  let app: App

  if (appToken) {
    // Socket Mode (dev / staging) — no HTTP receiver needed
    app = new App({ token, signingSecret, socketMode: true, appToken })
  } else {
    // HTTP mode (production) — mount on the shared Express instance
    const receiver = new ExpressReceiver({
      signingSecret,
      app: expressApp,
      path: '/slack/events',
    })
    app = new App({ token, receiver })
  }

  registerCommands(app)
  registerActions(app)

  // Start is only required for Socket Mode; HTTP mode piggybacks on Express
  if (appToken) {
    app.start()
      .then(() => console.log('[Slack] Bot connected via Socket Mode'))
      .catch((err) => console.error('[Slack] Failed to start Socket Mode:', err))
  } else {
    console.log('[Slack] Bot registered at POST /slack/events (HTTP mode)')
  }

  return app
}
