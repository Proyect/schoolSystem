const { Pool } = require('pg');
const { getOptimizedConfig } = require('./config/performance');

// Obtener configuración optimizada según el entorno
const config = getOptimizedConfig();
const dbConfig = config.database;

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'school_system',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  // Configuración optimizada del pool
  max: dbConfig.max,
  min: dbConfig.min,
  idleTimeoutMillis: dbConfig.idleTimeoutMillis,
  connectionTimeoutMillis: dbConfig.connectionTimeoutMillis,
  acquireTimeoutMillis: dbConfig.acquireTimeoutMillis,
  createTimeoutMillis: dbConfig.createTimeoutMillis,
  destroyTimeoutMillis: dbConfig.destroyTimeoutMillis,
  reapIntervalMillis: dbConfig.reapIntervalMillis,
  createRetryIntervalMillis: dbConfig.createRetryIntervalMillis,
  // Configuraciones adicionales para mejor rendimiento
  statement_timeout: 30000, // 30 segundos
  query_timeout: 30000, // 30 segundos
  application_name: 'school-system-backend',
  // Configuración SSL para producción
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Event listeners optimizados
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de base de datos:', err);
  // En producción, no salir del proceso inmediatamente
  if (process.env.NODE_ENV !== 'production') {
    process.exit(-1);
  }
});

pool.on('connect', (client) => {
  console.log('Nueva conexión a la base de datos establecida');
});

pool.on('acquire', (client) => {
  console.log('Cliente adquirido del pool');
});

pool.on('remove', (client) => {
  console.log('Cliente removido del pool');
});

// Función para verificar la salud de la conexión
const healthCheck = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'unhealthy', error: error.message, timestamp: new Date().toISOString() };
  }
};

// Función para obtener estadísticas del pool
const getPoolStats = () => {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    max: pool.options.max,
    min: pool.options.min
  };
};

// Función para cerrar el pool de forma segura
const closePool = async () => {
  try {
    await pool.end();
    console.log('Pool de conexiones cerrado correctamente');
  } catch (error) {
    console.error('Error cerrando el pool:', error);
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