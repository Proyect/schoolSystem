const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'school_system',
  password: process.env.DB_PASSWORD || 'password',
  port: process.env.DB_PORT || 5432,
  // Configuración optimizada del pool
  max: 20, // máximo número de conexiones en el pool
  idleTimeoutMillis: 30000, // tiempo máximo que una conexión puede estar inactiva
  connectionTimeoutMillis: 2000, // tiempo máximo para establecer una conexión
});

// Manejo de errores del pool
pool.on('error', (err) => {
  console.error('Error inesperado en el pool de base de datos:', err);
  process.exit(-1);
});

module.exports = pool; 