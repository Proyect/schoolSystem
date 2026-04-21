#!/usr/bin/env node
/**
 * Runner de migraciones: aplica archivos SQL en database/migrations/ en orden.
 * Solo para PostgreSQL real (no pg-mem). Crea la tabla schema_migrations si no existe.
 * Uso: node scripts/runMigrations.js
 *      o: npm run db:migrate:run (con DATABASE_URL o DB_* en .env)
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');

async function run() {
  if ((process.env.DB_VENDOR || '').toLowerCase() === 'pgmem') {
    console.log('Migraciones omitidas: DB_VENDOR=pgmem (solo para PostgreSQL real).');
    process.exit(0);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    ...(!process.env.DATABASE_URL && {
      user: process.env.DB_USER || 'postgres',
      host: process.env.DB_HOST || 'localhost',
      database: process.env.DB_NAME || 'school_system',
      password: process.env.DB_PASSWORD || 'password',
      port: Number(process.env.DB_PORT) || 5432
    })
  });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const name = file;
      const result = await pool.query('SELECT 1 FROM schema_migrations WHERE name = $1', [name]);
      if (result.rowCount > 0) {
        console.log('  (ya aplicada) ', name);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await pool.query(sql);
      await pool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
      console.log('  aplicada:    ', name);
    }

    console.log('Migraciones listas.');
  } catch (err) {
    console.error('Error en migraciones:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
