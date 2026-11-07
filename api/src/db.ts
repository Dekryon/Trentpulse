import pg from 'pg'
import 'dotenv/config'

if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL. Copy .env.example to .env and paste your Tiger Data connection string.')
  process.exit(1)
}

// One shared pool of connections to Tiger Data (it is plain Postgres)
export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5 })
