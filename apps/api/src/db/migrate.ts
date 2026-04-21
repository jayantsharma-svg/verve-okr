import 'dotenv/config'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))

const { Client } = pg

async function migrate() {
  const client = new Client({
    connectionString: process.env['DATABASE_URL'],
    ssl: false,
  })

  await client.connect()
  console.log('[migrate] Connected to database')

  const sql = readFileSync(join(__dirname, 'schema.sql'), 'utf-8')

  // Run in a transaction so partial failures roll back cleanly.
  // The schema uses CREATE TABLE IF NOT EXISTS / CREATE TYPE … so it is safe
  // to re-run against an existing database.
  await client.query('BEGIN')
  try {
    await client.query(sql)
    await client.query('COMMIT')
    console.log('[migrate] Schema applied successfully')
  } catch (err: any) {
    await client.query('ROLLBACK')
    // If objects already exist just warn — the schema is already current.
    if (err.code === '42710' || err.code === '42P07') {
      console.log('[migrate] Schema already up to date (objects exist), skipping.')
    } else {
      throw err
    }
  }

  await client.end()
}

migrate().catch((err) => {
  console.error('[migrate] Failed:', err.message)
  process.exit(1)
})
