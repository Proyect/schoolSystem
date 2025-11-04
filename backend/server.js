require("dotenv").config();
const express = require("express");
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

// Importar rutas
const authRoutes = require("./routes/auth");
const computerRoutes = require("./routes/computers");
const reservationRoutes = require("./routes/reservations");
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reports");
const settingsRoutes = require("./routes/settings");

const app = express();

 // Confiar en el proxy para obtener IPs reales (útil detrás de Nginx/Heroku)
 app.set('trust proxy', 1);

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

app.use(cors({
  origin: function (origin, callback) {
    // Permitir llamadas server-to-server (sin origin)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('No permitido por CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
app.use("/api/users", sensitiveRateLimit, userRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/settings", sensitiveRateLimit, settingsRoutes);

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

// Middleware de manejo de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Algo salió mal!" });
});

// Middleware para rutas no encontradas
app.use("*", (req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor ejecutándose en http://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});
