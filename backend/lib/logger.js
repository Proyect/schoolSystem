/**
 * Logger estructurado: pino en producción (JSON), console en desarrollo.
 * Nivel configurable por LOG_LEVEL (error, warn, info, debug).
 */

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL || (isProd ? "info" : "debug");

let logger;

if (isProd) {
  try {
    const pino = require("pino");
    logger = pino({
      level,
      formatters: {
        level: (label) => ({ level: label })
      }
    });
  } catch (e) {
    logger = fallbackLogger();
  }
} else {
  logger = fallbackLogger();
}

function fallbackLogger() {
  return {
    info: (...args) => console.log("[INFO]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    debug: (...args) => (level === "debug" ? console.log("[DEBUG]", ...args) : undefined),
    child: () => fallbackLogger()
  };
}

module.exports = logger;
