const fs = require('fs');
const path = require('path');
const { getOptimizedConfig } = require('./config/performance');
const logger = require('./lib/logger');

const isProd = process.env.NODE_ENV === 'production';
const usePgMem = (process.env.DB_VENDOR || '').toLowerCase() === 'pgmem';

let pool;
let isMemory = false;

if (usePgMem) {
  // Modo testing: Postgres en memoria con pg-mem
  const { newDb } = require('pg-mem');
  const mem = newDb({ autoCreateForeignKeyIndices: true });

  // Cargar y adaptar schema.sql (sin vistas materializadas/índices sobre vistas)
  try {
    const schemaPath = path.join(__dirname, 'database', 'schema.sql');
    let schemaSql = fs.readFileSync(schemaPath, 'utf8');

    // Transformaciones mínimas para compatibilidad en memoria
    schemaSql = schemaSql
      .replace(/CREATE\s+MATERIALIZED\s+VIEW/gi, 'CREATE VIEW')
      .replace(/REFRESH\s+MATERIALIZED\s+VIEW[^;]*;/gi, '-- skipped refresh for pg-mem;')
      .replace(/CREATE\s+UNIQUE\s+INDEX\s+idx_mv_computer_usage_stats_id[^;]*;/gi, '-- skipped index on view for pg-mem;');

    mem.public.none(schemaSql);
  } catch (e) {
    logger.warn({ msg: 'No se pudo cargar schema.sql en pg-mem (se usa esquema mínimo)', err: e.message });
  }

  // Fallback: crear esquema mínimo si la tabla users no existe
  try {
    mem.public.none(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'student',
        first_name VARCHAR(100) NOT NULL DEFAULT 'User',
        last_name VARCHAR(100) NOT NULL DEFAULT 'Local',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS computers (
        id SERIAL PRIMARY KEY,
        code VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        serial_number VARCHAR(100),
        hardware_id VARCHAR(100),
        status VARCHAR(20) NOT NULL DEFAULT 'available',
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS reservations (
        id SERIAL PRIMARY KEY,
        computer_id INTEGER REFERENCES computers(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        start_time TIMESTAMP NOT NULL,
        end_time TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        action VARCHAR(255) NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        resource_id INTEGER,
        status_code INTEGER,
        details TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(255) UNIQUE NOT NULL,
        setting_value TEXT NOT NULL,
        setting_type VARCHAR(50) NOT NULL DEFAULT 'string',
        description TEXT,
        updated_by INTEGER REFERENCES users(id),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);
  } catch (e) {
    logger.error({ msg: 'Error creando esquema mínimo en pg-mem', err: e.message });
  }

  // Exponer interfaz Pool compatible con pg
  const adapter = mem.adapters.createPg();
  const { Pool: MemPool } = adapter;
  pool = new MemPool();
  isMemory = true;
  logger.debug('Base de datos en memoria (pg-mem) inicializada');
} else {
  // Modo normal: PostgreSQL real con pg
  const { Pool } = require('pg');
  const { getOptimizedConfig } = require('./config/performance');

  // Obtener configuración optimizada según el entorno
  const config = getOptimizedConfig();
  const dbConfig = config.database;

  // Soportar DATABASE_URL en producción u otros entornos
  const basePoolOptions = process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: isProd ? { rejectUnauthorized: false } : false,
      }
    : {
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        database: process.env.DB_NAME || 'school_system',
        password: process.env.DB_PASSWORD || 'password',
        port: Number(process.env.DB_PORT) || 5432,
        ssl: isProd ? { rejectUnauthorized: false } : false,
      };

  pool = new Pool({
    ...basePoolOptions,
    // Configuración optimizada del pool
    max: dbConfig.max,
    min: dbConfig.min,
    idleTimeoutMillis: dbConfig.idleTimeoutMillis,
    connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
    // Configuraciones adicionales para mejor rendimiento
    statement_timeout: 30000, // 30 segundos
    query_timeout: 30000, // 30 segundos
    application_name: 'school-system-backend',
  });

  // Event listeners optimizados
  pool.on('error', (err) => {
    logger.error({ msg: 'Error en el pool de base de datos', err: err.message });
    if (!isProd) process.exit(-1);
  });

  pool.on('connect', () => logger.debug('Nueva conexión a la base de datos'));
  pool.on('acquire', () => logger.debug('Cliente adquirido del pool'));
  pool.on('remove', () => logger.debug('Cliente removido del pool'));
}

// Función para verificar la salud de la conexión
const healthCheck = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { status: 'healthy', timestamp: new Date().toISOString(), inMemory: isMemory };
  } catch (error) {
    logger.error({ msg: 'Health check failed', err: error.message });
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString(), inMemory: isMemory };
  }
};

// Función para obtener estadísticas del pool
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount || 0,
    idleCount: pool.idleCount || 0,
    waitingCount: pool.waitingCount || 0,
    max: (pool.options && pool.options.max) || null,
    min: (pool.options && pool.options.min) || null,
    inMemory: isMemory
  };
};

// Función para cerrar el pool de forma segura
const closePool = async () => {
  try {
    if (pool && pool.end) {
      await pool.end();
    }
    logger.info('Pool de conexiones cerrado');
  } catch (error) {
    logger.error({ msg: 'Error cerrando el pool', err: error.message });
  }
};

// Manejar cierre graceful del proceso
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

module.exports = {
  pool,
  healthCheck,
  getPoolStats,
  closePool
};
 