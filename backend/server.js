require("dotenv").config();
const crypto = require("crypto");
const express = require("express");
const logger = require("./lib/logger");
const cors = require("cors");
const helmet = require("helmet");
const { requestLogger, securityMonitor, sanitizeInput } = require("./middleware/logging");
const { 
  authRateLimit, 
  sensitiveRateLimit, 
  generalRateLimit, 
  speedLimiter,
  securityHeaders,
  payloadSizeLimit,
  botDetection,
  securityLogger
} = require("./middleware/security");
const { healthCheck, getPoolStats } = require("./db");

// Validar variables de entorno al arranque
function validateEnv() {
  const errors = [];
  if (!process.env.JWT_SECRET || typeof process.env.JWT_SECRET !== "string") {
    errors.push("JWT_SECRET es requerido y debe ser una cadena no vacía");
  } else if (process.env.JWT_SECRET.length < 16) {
    errors.push("JWT_SECRET debe tener al menos 16 caracteres por seguridad");
  }
  const usePgMem = (process.env.DB_VENDOR || "").toLowerCase() === "pgmem";
  if (!usePgMem && !process.env.DATABASE_URL) {
    const hasDbVars = process.env.DB_HOST && process.env.DB_NAME && process.env.DB_USER;
    if (!hasDbVars) {
      errors.push("Con PostgreSQL real se requiere DATABASE_URL o DB_HOST, DB_NAME y DB_USER");
    }
  }
  if (errors.length > 0) {
    logger.error({ msg: "Configuración inválida", errors });
    process.exit(1);
  }
}
validateEnv();

// Importar rutas
const authRoutes = require("./routes/auth");
const computerRoutes = require("./routes/computers");
const reservationRoutes = require("./routes/reservations");
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reports");
const settingsRoutes = require("./routes/settings");

const app = express();

// Middleware: asignar requestId a cada petición (para logs y respuestas de error)
app.use((req, res, next) => {
  req.requestId = req.get("X-Request-Id") || crypto.randomUUID();
  res.setHeader("X-Request-Id", req.requestId);
  next();
});

// Confiar en el proxy para obtener IPs reales (útil detrás de Nginx/Heroku)
app.set("trust proxy", 1);

// Configuración de seguridad avanzada
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));

// Headers de seguridad personalizados
app.use(securityHeaders);

// Configuración de CORS mejorada (soporta múltiples orígenes por env)
const parseOrigins = () => {
  const envOrigins = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
  const list = Array.isArray(envOrigins)
    ? envOrigins
    : String(envOrigins)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
  // defaults de desarrollo
  const defaults = [
    'http://localhost:4001',
    'https://localhost:4001'
  ];
  return Array.from(new Set([...list, ...defaults]));
};

const allowedOrigins = parseOrigins();

// Rechazar orígenes no permitidos con 403 JSON (sin lanzar error)
app.use((req, res, next) => {
  const origin = req.get("Origin");
  if (origin && !allowedOrigins.includes(origin)) {
    return res.status(403).json({ error: "Origen no permitido por CORS" });
  }
  next();
});

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
}));

// Rate limiting y seguridad
app.use(generalRateLimit);
app.use(speedLimiter);
app.use(botDetection);

// Middleware para parsing JSON con límite de tamaño
app.use(payloadSizeLimit('10mb'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de seguridad y logging
app.use(requestLogger);
app.use(securityMonitor);
app.use(securityLogger);
app.use(sanitizeInput);

// Rutas con rate limiting específico
app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/computers", computerRoutes);
app.use("/api/reservations", reservationRoutes);
app.use("/api/users", sensitiveRateLimit, userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", sensitiveRateLimit, settingsRoutes);

// Documentación API (OpenAPI / Swagger UI)
const path = require("path");
const fs = require("fs");
let swaggerUiMiddleware = null;
try {
  const swaggerUi = require("swagger-ui-express");
  const yaml = require("yaml");
  const specPath = path.join(__dirname, "openapi.yaml");
  if (fs.existsSync(specPath)) {
    const spec = yaml.parse(fs.readFileSync(specPath, "utf8"));
    swaggerUiMiddleware = [swaggerUi.serve, swaggerUi.setup(spec)];
  }
} catch (e) {
  logger.warn({ msg: "Swagger UI no disponible", err: e.message });
}
app.use("/api-docs", (req, res, next) => {
  if (swaggerUiMiddleware) {
    return swaggerUiMiddleware[0](req, res, () => swaggerUiMiddleware[1](req, res, next));
  }
  res.status(200).json({
    message: "Swagger UI no disponible. En backend ejecuta: npm install",
    openapi: "http://localhost:5051/openapi.yaml",
    login: "POST /api/auth/login con body: { \"email\": \"admin@school.com\", \"password\": \"password123\" }"
  });
});
app.get("/openapi.yaml", (req, res) => {
  const specPath = path.join(__dirname, "openapi.yaml");
  if (fs.existsSync(specPath)) {
    res.type("yaml").sendFile(specPath);
  } else {
    res.status(404).json({ error: "openapi.yaml no encontrado" });
  }
});

// Ruta de salud
app.get("/health", (req, res) => {
  res.json({ 
    status: "OK", 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Ruta de salud de base de datos
app.get("/health/db", async (req, res) => {
  try {
    const dbStatus = await healthCheck();
    const pool = getPoolStats();
    res.json({ status: "OK", db: dbStatus, pool });
  } catch (e) {
    res.status(500).json({ status: "ERROR", error: e.message });
  }
});

// Ruta de métricas del pool
app.get("/health/pool", (req, res) => {
  try {
    const pool = getPoolStats();
    res.json({ status: "OK", pool });
  } catch (e) {
    res.status(500).json({ status: "ERROR", error: e.message });
  }
});

// Ruta raíz
app.get("/", (req, res) => res.json({ 
  message: "API del Sistema Escolar funcionando",
  version: "1.0.0"
}));

// Middleware de manejo de errores (no exponer detalles en producción)
app.use((err, req, res, next) => {
  const requestId = req.requestId || "unknown";
  const status = err.status || err.statusCode || 500;
  logger.error({ requestId, err: err.message, stack: err.stack });
  const isProd = process.env.NODE_ENV === "production";
  res.status(status).json({
    error: isProd ? "Error interno del servidor" : (err.message || "Algo salió mal"),
    requestId: isProd ? requestId : undefined
  });
});

// Middleware para rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

const PORT = process.env.PORT || 5000;

async function start() {
  if (process.env.NODE_ENV !== "production" && process.env.DB_VENDOR === "pgmem") {
    const { initDatabase } = require("./scripts/initDb");
    try {
      await initDatabase();
    } catch (err) {
      logger.error({ msg: "Error inicializando BD", err: err.message });
      process.exit(1);
    }
  }

  app.listen(PORT, () => {
    logger.info(`Servidor en http://localhost:${PORT} | Health: http://localhost:${PORT}/health`);
  });
}

module.exports = { app, start };
if (require.main === module) start();
