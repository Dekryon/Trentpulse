// Runs db/schema.sql against your Tiger Data service, one statement at a time
// (some TimescaleDB commands cannot run inside one big transaction).
import { readFileSync } from 'node:fs'
import { pool } from '../src/db.js'

const sql = readFileSync(new URL('../../db/schema.sql', import.meta.url), 'utf8')
const statements = sql
  .split(/;\s*\n/)
  .map((s) => s.replace(/^\s*--.*$/gm, '').trim())
  .filter(Boolean)

for (const st of statements) {
  const first = st.split('\n')[0].slice(0, 70)
  try {
    await pool.query(st)
    console.log('ok   ', first)
  } catch (err) {
    console.error('FAIL ', first, '\n     ', (err as Error).message)
  }
}
console.log('Schema applied.')
await pool.end()
