const { pool } = require('../db');

// Middleware de logging para auditoría
const auditLogger = (action) => {
  return (req, res, next) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Solo hacer log si la operación fue exitosa
      if (res.statusCode >= 200 && res.statusCode < 300) {
        logAuditEvent(req, action, res.statusCode);
      }
      originalSend.call(this, data);
    };
    
    next();
  };
};

// Cache para evitar logs duplicados
const auditCache = new Map();
const CACHE_TTL = 5000; // 5 segundos

// Función para registrar eventos de auditoría
const logAuditEvent = async (req, action, statusCode) => {
  try {
    const user_id = req.user ? req.user.id : null;
    const user_email = req.user ? req.user.email : null;
    const ip_address = req.ip || req.connection.remoteAddress;
    const user_agent = req.get('User-Agent');
    const resource_id = req.params.id || null;
    
    // Crear clave única para evitar logs duplicados
    const cacheKey = `${action}-${user_id}-${resource_id}-${Date.now()}`;
    const cacheKeyBase = `${action}-${user_id}-${resource_id}`;
    
    // Verificar si ya se registró recientemente
    if (auditCache.has(cacheKeyBase)) {
      const lastLog = auditCache.get(cacheKeyBase);
      if (Date.now() - lastLog < CACHE_TTL) {
        return; // Evitar logs duplicados
      }
    }
    
    // Actualizar cache
    auditCache.set(cacheKeyBase, Date.now());
    
    // Limpiar cache antiguo
    if (auditCache.size > 1000) {
      const now = Date.now();
      for (const [key, timestamp] of auditCache.entries()) {
        if (now - timestamp > CACHE_TTL * 2) {
          auditCache.delete(key);
        }
      }
    }
    
    // Log estructurado para mejor análisis
    const logEntry = {
      timestamp: new Date().toISOString(),
      action,
      user_id,
      user_email: user_email || 'Anonymous',
      ip_address,
      resource_id: resource_id || 'N/A',
      status_code: statusCode,
      user_agent: user_agent ? user_agent.substring(0, 100) : null // Limitar tamaño
    };
    
    console.log(`[AUDIT] ${JSON.stringify(logEntry)}`);
    
    // Guardar en base de datos de forma asíncrona (no bloquear respuesta)
    setImmediate(async () => {
      try {
        await pool.query(`
          INSERT INTO audit_logs (user_id, action, ip_address, user_agent, resource_id, status_code, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, NOW())
        `, [user_id, action, ip_address, user_agent, resource_id, statusCode]);
      } catch (dbError) {
        console.error('Error saving audit log to database:', dbError);
      }
    });
    
  } catch (error) {
    console.error('Error logging audit event:', error);
  }
};

// Cache para requests frecuentes
const requestCache = new Map();
const REQUEST_CACHE_TTL = 10000; // 10 segundos

// Middleware para logging de requests optimizado
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    const user = req.user ? req.user.email : 'Anonymous';
    const ip = req.ip || req.connection.remoteAddress;
    
    // Solo loggear requests lentos o errores para reducir ruido
    const shouldLog = duration > 1000 || res.statusCode >= 400 || req.originalUrl.includes('/api/');
    
    if (shouldLog) {
      const logEntry = {
        timestamp: new Date().toISOString(),
        method: req.method,
        url: req.originalUrl,
        status: res.statusCode,
        duration: `${duration}ms`,
        user,
        ip,
        userAgent: req.get('User-Agent')?.substring(0, 50)
      };
      
      console.log(`[REQUEST] ${JSON.stringify(logEntry)}`);
    }
    
    // Limpiar cache de requests
    if (requestCache.size > 500) {
      const now = Date.now();
      for (const [key, timestamp] of requestCache.entries()) {
        if (now - timestamp > REQUEST_CACHE_TTL) {
          requestCache.delete(key);
        }
      }
    }
  });
  
  next();
};

// Cache para IPs sospechosas
const suspiciousIPs = new Map();
const IP_BLOCK_DURATION = 300000; // 5 minutos

// Middleware para detectar actividad sospechosa optimizado
const securityMonitor = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent');
  
  // Verificar si la IP está bloqueada
  if (suspiciousIPs.has(ip)) {
    const blockInfo = suspiciousIPs.get(ip);
    if (Date.now() - blockInfo.timestamp < IP_BLOCK_DURATION) {
      return res.status(429).json({ 
        error: 'IP bloqueada temporalmente por actividad sospechosa',
        retryAfter: Math.ceil((IP_BLOCK_DURATION - (Date.now() - blockInfo.timestamp)) / 1000)
      });
    } else {
      suspiciousIPs.delete(ip); // Remover bloqueo expirado
    }
  }
  
  // Detectar patrones sospechosos más específicos
  const suspiciousPatterns = [
    /<script[^>]*>.*?<\/script>/gi,
    /javascript\s*:/gi,
    /union\s+select/gi,
    /drop\s+table/gi,
    /insert\s+into/gi,
    /delete\s+from/gi,
    /update\s+set/gi,
    /exec\s*\(/gi,
    /eval\s*\(/gi
  ];
  
  const requestData = JSON.stringify(req.body) + req.originalUrl + (req.query ? JSON.stringify(req.query) : '');
  
  const isSuspicious = suspiciousPatterns.some(pattern => pattern.test(requestData));
  
  if (isSuspicious) {
    const securityEvent = {
      timestamp: new Date().toISOString(),
      ip,
      userAgent: userAgent?.substring(0, 100),
      method: req.method,
      url: req.originalUrl,
      suspiciousPattern: 'Detected',
      user: req.user ? req.user.email : 'Anonymous'
    };
    
    console.warn(`[SECURITY] ${JSON.stringify(securityEvent)}`);
    
    // Incrementar contador de actividad sospechosa
    const currentCount = suspiciousIPs.get(ip)?.count || 0;
    suspiciousIPs.set(ip, {
      count: currentCount + 1,
      timestamp: Date.now(),
      lastActivity: req.originalUrl
    });
    
    // Bloquear IP después de 3 intentos sospechosos
    if (currentCount >= 2) {
      console.error(`[SECURITY] IP ${ip} bloqueada por actividad sospechosa repetida`);
      return res.status(429).json({ 
        error: 'Actividad sospechosa detectada. IP bloqueada temporalmente.',
        retryAfter: Math.ceil(IP_BLOCK_DURATION / 1000)
      });
    }
  }
  
  // Limpiar cache de IPs antiguas
  if (suspiciousIPs.size > 1000) {
    const now = Date.now();
    for (const [key, value] of suspiciousIPs.entries()) {
      if (now - value.timestamp > IP_BLOCK_DURATION * 2) {
        suspiciousIPs.delete(key);
      }
    }
  }
  
  next();
};

// Cache para sanitización
const sanitizationCache = new Map();
const SANITIZATION_CACHE_SIZE = 1000;

// Middleware para sanitizar entrada optimizado
const sanitizeInput = (req, res, next) => {
  const sanitize = (obj) => {
    if (typeof obj === 'string') {
      // Verificar cache primero
      if (sanitizationCache.has(obj)) {
        return sanitizationCache.get(obj);
      }
      
      const sanitized = obj
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remover scripts
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remover iframes
        .replace(/javascript:/gi, '') // Remover javascript:
        .replace(/on\w+\s*=/gi, '') // Remover event handlers
        .replace(/data\s*:/gi, '') // Remover data URLs
        .replace(/vbscript:/gi, '') // Remover vbscript
        .replace(/expression\s*\(/gi, '') // Remover CSS expressions
        .trim();
      
      // Guardar en cache si no es muy grande
      if (sanitizationCache.size < SANITIZATION_CACHE_SIZE && obj.length < 1000) {
        sanitizationCache.set(obj, sanitized);
      }
      
      return sanitized;
    } else if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) {
        return obj.map(item => sanitize(item));
      } else {
        const sanitizedObj = {};
        for (let key in obj) {
          sanitizedObj[key] = sanitize(obj[key]);
        }
        return sanitizedObj;
      }
    }
    return obj;
  };
  
  try {
    if (req.body) {
      req.body = sanitize(req.body);
    }
    
    if (req.query) {
      req.query = sanitize(req.query);
    }
    
    // Limpiar cache periódicamente
    if (sanitizationCache.size > SANITIZATION_CACHE_SIZE) {
      const entries = Array.from(sanitizationCache.entries());
      sanitizationCache.clear();
      // Mantener solo la mitad más reciente
      entries.slice(-SANITIZATION_CACHE_SIZE / 2).forEach(([key, value]) => {
        sanitizationCache.set(key, value);
      });
    }
    
  } catch (error) {
    console.error('Error sanitizing input:', error);
    // Continuar sin sanitizar en caso de error
  }
  
  next();
};

module.exports = {
  auditLogger,
  requestLogger,
  securityMonitor,
  sanitizeInput
};
