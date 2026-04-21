# Verificación de errores del sistema

**Fecha:** 2026-03-17

---

## Resumen

| Aspecto              | Estado |
|----------------------|--------|
| Tests (Jest)         | OK – 13 tests pasan |
| Linter (ESLint)      | Sin config en backend (ejecutar `npm init @eslint/config` si se quiere) |
| Errores corregidos   | Ver abajo |

---

## 1. Tests

- **Unitarios:** `validation.test.js`, `computerStatus.test.js` – pasan.
- **Integración:** `auth.integration.test.js` (login) – pasa.
- **Advertencia en tests:** Al usar pg-mem, el `schema.sql` completo no se puede parsear (límite de pg-mem con funciones PL/pgSQL e `INTERVAL`). El sistema usa el **esquema mínimo** en memoria y `initDb.js` crea usuarios y datos. No es un error del código.

---

## 2. Cambios realizados

- **`backend/db.js`:** El aviso cuando falla la carga del schema en pg-mem ahora usa `logger.warn` en lugar de `console.warn`.
- **`backend/routes/auth.js`:** Los errores de login se registran con `logger.error` en lugar de `console.error`.
- **`backend/routes/reports.js`:** Los errores de reportes y exportación se registran con `logger.error` en lugar de `console.error`.

Así todo el logging pasa por el logger (pino en producción, console en desarrollo).

---

## 3. Errores conocidos / no críticos

1. **pg-mem y schema completo**  
   Al arrancar con `DB_VENDOR=pgmem`, puede aparecer un `warn` porque pg-mem no soporta todo el SQL del schema (funciones, `INTERVAL`, etc.). El fallback (esquema mínimo + initDb) funciona bien. Con PostgreSQL real no aplica.

2. **Script `npm run dev` en la raíz**  
   Con un solo proceso (solo backend), `concurrently` en Windows puede fallar (`prev.replace is not a function`). Alternativa: usar `npm run dev:backend` o `cd backend && npm run dev`.

3. **Frontend**  
   No existe en el repositorio. Para tener interfaz web hay que crear la app (por ejemplo en `frontend/school-app`).

---

## 4. Cómo volver a verificar

```bash
# Tests
cd backend
npm test

# Linter (requiere config: npm init @eslint/config en backend)
npm run lint
```

Si algo falla, revisar que existan `backend/.env` con `JWT_SECRET` (mín. 16 caracteres) y `DB_VENDOR=pgmem` para tests sin PostgreSQL.
