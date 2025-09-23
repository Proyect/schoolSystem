// Configuración de rendimiento del sistema

const performanceConfig = {
  // Configuración de pool de conexiones optimizada
  database: {
    max: 20, // máximo 20 conexiones
    min: 5,  // mínimo 5 conexiones
    idleTimeoutMillis: 30000, // 30 segundos
    connectionTimeoutMillis: 2000, // 2 segundos
    acquireTimeoutMillis: 60000, // 60 segundos
    createTimeoutMillis: 30000, // 30 segundos
    destroyTimeoutMillis: 5000, // 5 segundos
    reapIntervalMillis: 1000, // 1 segundo
    createRetryIntervalMillis: 200, // 200ms
  },

  // Configuración de cache
  cache: {
    // Cache de memoria
    memory: {
      maxSize: 1000, // máximo 1000 entradas
      ttl: 300000, // 5 minutos
      checkPeriod: 60000, // verificar cada minuto
    },
    
    // Cache de Redis (opcional)
    redis: {
      enabled: false, // deshabilitado por defecto
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      password: process.env.REDIS_PASSWORD,
      db: process.env.REDIS_DB || 0,
      ttl: 3600, // 1 hora
    }
  },

  // Configuración de compresión
  compression: {
    enabled: true,
    level: 6, // nivel de compresión (1-9)
    threshold: 1024, // comprimir archivos > 1KB
    filter: (req, res) => {
      // No comprimir si ya está comprimido
      if (req.headers['x-no-compression']) {
        return false;
      }
      // Usar compresión para todos los tipos de contenido
      return true;
    }
  },

  // Configuración de paginación
  pagination: {
    defaultLimit: 10,
    maxLimit: 100,
    defaultPage: 1
  },

  // Configuración de timeouts
  timeouts: {
    request: 30000, // 30 segundos
    database: 10000, // 10 segundos
    external: 5000, // 5 segundos
  },

  // Configuración de logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    slowQueryThreshold: 1000, // queries > 1 segundo
    maxLogSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 5
  },

  // Configuración de rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests
    skipSuccessfulRequests: true,
    skipFailedRequests: false
  },

  // Configuración de clustering
  clustering: {
    enabled: process.env.NODE_ENV === 'production',
    instances: process.env.CLUSTER_INSTANCES || require('os').cpus().length
  }
};

// Función para obtener configuración optimizada según el entorno
const getOptimizedConfig = (env = process.env.NODE_ENV) => {
  const config = { ...performanceConfig };

  switch (env) {
    case 'production':
      config.database.max = 50;
      config.database.min = 10;
      config.cache.memory.maxSize = 5000;
      config.cache.memory.ttl = 600000; // 10 minutos
      config.compression.level = 9;
      config.rateLimit.max = 200;
      break;

    case 'development':
      config.database.max = 10;
      config.database.min = 2;
      config.cache.memory.maxSize = 100;
      config.cache.memory.ttl = 60000; // 1 minuto
      config.compression.level = 1;
      config.rateLimit.max = 1000;
      break;

    case 'test':
      config.database.max = 5;
      config.database.min = 1;
      config.cache.memory.maxSize = 50;
      config.cache.memory.ttl = 10000; // 10 segundos
      config.compression.enabled = false;
      config.rateLimit.max = 10000;
      break;
  }

  return config;
};

// Función para monitorear rendimiento
const performanceMonitor = {
  metrics: {
    requests: 0,
    errors: 0,
    avgResponseTime: 0,
    slowQueries: 0,
    cacheHits: 0,
    cacheMisses: 0
  },

  startTimer: (label) => {
    const start = process.hrtime.bigint();
    return {
      end: () => {
        const end = process.hrtime.bigint();
        const duration = Number(end - start) / 1000000; // convertir a ms
        performanceMonitor.updateMetrics(label, duration);
        return duration;
      }
    };
  },

  updateMetrics: (label, duration) => {
    performanceMonitor.metrics.requests++;
    
    if (duration > 1000) {
      performanceMonitor.metrics.slowQueries++;
    }
    
    // Actualizar tiempo promedio de respuesta
    const currentAvg = performanceMonitor.metrics.avgResponseTime;
    const totalRequests = performanceMonitor.metrics.requests;
    performanceMonitor.metrics.avgResponseTime = 
      (currentAvg * (totalRequests - 1) + duration) / totalRequests;
  },

  getMetrics: () => {
    return {
      ...performanceMonitor.metrics,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      cpuUsage: process.cpuUsage()
    };
  },

  resetMetrics: () => {
    performanceMonitor.metrics = {
      requests: 0,
      errors: 0,
      avgResponseTime: 0,
      slowQueries: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
  }
};

module.exports = {
  performanceConfig,
  getOptimizedConfig,
  performanceMonitor
};

