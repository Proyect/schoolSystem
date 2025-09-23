const rateLimit = require('express-rate-limit');
const slowDown = require('express-slow-down');

// Rate limiting específico para diferentes endpoints
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { error: message },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Rate limiting para autenticación (más estricto)
const authRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutos
  5, // máximo 5 intentos
  'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
);

// Rate limiting para operaciones sensibles
const sensitiveRateLimit = createRateLimit(
  5 * 60 * 1000, // 5 minutos
  10, // máximo 10 operaciones
  'Demasiadas operaciones sensibles. Intenta de nuevo en 5 minutos.'
);

// Rate limiting general
const generalRateLimit = createRateLimit(
  15 * 60 * 1000, // 15 minutos
  100, // máximo 100 requests
  'Demasiadas requests. Intenta de nuevo en 15 minutos.'
);

// Slow down para requests repetitivos
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutos
  delayAfter: 50, // permitir 50 requests por ventana sin delay
  delayMs: 500, // agregar 500ms de delay por request después del límite
  maxDelayMs: 20000, // máximo delay de 20 segundos
  skipSuccessfulRequests: true, // no aplicar delay a requests exitosos
  skipFailedRequests: false // aplicar delay a requests fallidos
});

// Middleware para validar headers de seguridad
const securityHeaders = (req, res, next) => {
  // Prevenir clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  
  // Prevenir MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Habilitar XSS protection
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Referrer policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Content Security Policy básico
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "script-src 'self' 'unsafe-inline'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data: https:; " +
    "font-src 'self'; " +
    "connect-src 'self'; " +
    "frame-ancestors 'none';"
  );
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', 
    'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
  );
  
  next();
};

// Middleware para validar tamaño de payload
const payloadSizeLimit = (maxSize = '10mb') => {
  return (req, res, next) => {
    const contentLength = parseInt(req.get('content-length') || '0');
    const maxBytes = parseSize(maxSize);
    
    if (contentLength > maxBytes) {
      return res.status(413).json({
        error: 'Payload demasiado grande',
        maxSize: maxSize
      });
    }
    
    next();
  };
};

// Función helper para convertir tamaño a bytes
const parseSize = (size) => {
  const units = { b: 1, kb: 1024, mb: 1024 * 1024, gb: 1024 * 1024 * 1024 };
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  
  if (!match) return 10 * 1024 * 1024; // default 10MB
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
};

// Middleware para validar origen de requests
const validateOrigin = (allowedOrigins) => {
  return (req, res, next) => {
    const origin = req.get('origin');
    
    if (origin && !allowedOrigins.includes(origin)) {
      return res.status(403).json({
        error: 'Origen no permitido'
      });
    }
    
    next();
  };
};

// Middleware para detectar bots y crawlers
const botDetection = (req, res, next) => {
  const userAgent = req.get('User-Agent') || '';
  const botPatterns = [
    /bot/i, /crawler/i, /spider/i, /scraper/i,
    /curl/i, /wget/i, /python/i, /java/i,
    /postman/i, /insomnia/i
  ];
  
  const isBot = botPatterns.some(pattern => pattern.test(userAgent));
  
  if (isBot && !req.path.startsWith('/api/health')) {
    console.warn(`[SECURITY] Bot detected: ${userAgent} from ${req.ip}`);
    return res.status(403).json({
      error: 'Acceso no permitido para bots'
    });
  }
  
  next();
};

// Middleware para validar método HTTP
const validateMethod = (allowedMethods) => {
  return (req, res, next) => {
    if (!allowedMethods.includes(req.method)) {
      return res.status(405).json({
        error: 'Método no permitido',
        allowed: allowedMethods
      });
    }
    
    next();
  };
};

// Middleware para logging de seguridad
const securityLogger = (req, res, next) => {
  const securityEvents = [];
  
  // Detectar patrones sospechosos
  if (req.get('User-Agent')?.length > 500) {
    securityEvents.push('Suspicious User-Agent length');
  }
  
  if (req.get('X-Forwarded-For')?.split(',').length > 5) {
    securityEvents.push('Multiple proxy headers');
  }
  
  if (req.url.length > 2000) {
    securityEvents.push('Suspicious URL length');
  }
  
  if (securityEvents.length > 0) {
    console.warn(`[SECURITY] ${securityEvents.join(', ')} - IP: ${req.ip} - URL: ${req.url}`);
  }
  
  next();
};

module.exports = {
  authRateLimit,
  sensitiveRateLimit,
  generalRateLimit,
  speedLimiter,
  securityHeaders,
  payloadSizeLimit,
  validateOrigin,
  botDetection,
  validateMethod,
  securityLogger
};

