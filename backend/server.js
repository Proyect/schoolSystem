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

// Importar rutas
const authRoutes = require("./routes/auth");
const computerRoutes = require("./routes/computers");
const reservationRoutes = require("./routes/reservations");
const userRoutes = require("./routes/users");
const reportRoutes = require("./routes/reports");
const settingsRoutes = require("./routes/settings");

const app = express();

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
  crossOriginEmbedderPolicy: false
}));

// Headers de seguridad personalizados
app.use(securityHeaders);

// Configuración de CORS mejorada
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      process.env.FRONTEND_URL || "http://localhost:3000",
      "http://localhost:3000",
      "https://localhost:3000"
    ];
    
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Rate limiting y seguridad
app.use(generalRateLimit);
app.use(speedLimiter);
app.use(botDetection);
app.use(securityLogger);

// Middleware para parsing JSON con límite de tamaño
app.use(payloadSizeLimit('10mb'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Middleware de seguridad y logging
app.use(requestLogger);
app.use(securityMonitor);
app.use(sanitizeInput);

// Rutas con rate limiting específico
app.use("/api/auth", authRateLimit, authRoutes);
app.use("/api/computers", computerRoutes);
app.use("/api/reservations", reservationRoutes);
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
