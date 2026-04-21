# Auditoría del proyecto schoolSystem

**Fecha:** 27 de marzo de 2026  
**Ámbito:** Backend (Node/Express/PostgreSQL o pg-mem), frontend mínimo (Next.js), seguridad, dependencias y pruebas.

---

## 1. Arranque del proyecto

| Servicio | Comando habitual | URL |
|----------|------------------|-----|
| **Backend** | `cd backend && npm run dev` (requiere `JWT_SECRET` y, para memoria, `DB_VENDOR=pgmem`) | http://localhost:5051 |
| **Frontend** | `cd frontend/school-app && npm run dev` | http://localhost:4001 |
| **Salud API** | — | GET http://localhost:5051/health |
| **Documentación API** | — | GET http://localhost:5051/api-docs (requiere dependencias `swagger-ui-express` y `yaml` instaladas en `backend`) |

**Durante esta auditoría** se comprobó el arranque con `node server.js` (pg-mem + `initDb`) y el servidor quedó escuchando en **5051**. El frontend Next.js queda en **4001** según el script `dev`.

Si el puerto **5051** está ocupado, el backend falla con `EADDRINUSE`; hay que cerrar el proceso que lo usa o cambiar `PORT` en `.env`.

---

## 2. Arquitectura general

- **Backend**: Express, rutas modulares (`auth`, `computers`, `reservations`, `users`, `reports`, `settings`), capa de middleware (auth JWT, validación, seguridad, logging/auditoría).
- **Base de datos**: PostgreSQL en producción o **pg-mem** en desarrollo; `schema.sql` + migraciones incrementales (`npm run db:migrate:run`).
- **Frontend**: App Next.js 14 mínima (`/`, `/login`, `/dashboard`), token en `localStorage`, fetch directo a `NEXT_PUBLIC_API_URL`.
- **Monorepo**: Raíz con `scripts/dev.js` (intenta backend + frontend con `concurrently`; en algunos entornos Windows ha fallado con `concurrently`).

---

## 3. Seguridad (apreciación)

| Aspecto | Estado | Notas |
|---------|--------|--------|
| Autenticación | **Adecuado** | JWT Bearer; `JWT_SECRET` validado al arranque (longitud mínima). |
| Contraseñas | **Adecuado** | bcrypt en almacenamiento/comparación. |
| CORS | **Adecuado** | Orígenes explícitos; 403 JSON si el origen no está permitido. |
| Cabeceras | **Adecuado** | Helmet + cabeceras personalizadas en `security.js`. |
| Rate limiting | **Adecuado** | Límites distintos para auth, rutas sensibles y general. |
| Entrada | **Adecuado** | Validación y sanitización en middleware; monitoreo de patrones sospechosos. |
| Errores HTTP | **Adecuado** | En producción evita exponer stack; incluye `requestId` cuando aplica. |
| Auditoría | **Adecuado** | `audit_logs` + eventos `login_success` / `login_failure`. |
| HTTPS | **Pendiente de despliegue** | En local es HTTP; en producción debe ir detrás de TLS (proxy/reverse). |
| Secretos | **Riesgo si se sube `.env`** | `.gitignore` incluye `.env`; no commitear credenciales. |
| Frontend | **Limitado** | Token en `localStorage` (vulnerable a XSS); mitigar con CSP en el host del front y no exponer librerías inseguras. |

---

## 4. Dependencias (npm audit)

- **Backend** (ejecución reciente): **12 vulnerabilidades reportadas** (1 baja, 4 moderadas, 7 altas); muchas suelen venir de la cadena de **eslint** / herramientas de dev. Recomendación: `npm audit` y `npm audit fix` donde sea seguro, y revisar manualmente lo que requiera mayor versión.
- **Frontend**: Historial típico de **1 vulnerabilidad alta** en el árbol de Next (según `npm audit` previo); ejecutar `npm audit` en `frontend/school-app` y actualizar cuando haya parches compatibles.

No sustituir versiones mayores sin probar la suite de tests (`npm test` en backend).

---

## 5. Pruebas automatizadas

- **Jest** en `backend`: tests de `validation`, `computerStatus` y **integración de login** — **13 tests pasan**.
- **Cobertura funcional aún limitada**: faltan tests sobre reservas, reportes, settings y reglas de negocio complejas.
- **Linter**: el script `npm run lint` existe pero **no hay archivo de configuración ESLint** en el backend; el análisis estático no está integrado de forma útil hasta crear `.eslintrc` o `eslint.config.js`.

---

## 6. Base de datos y pg-mem

- Al usar **pg-mem**, el parseo del **schema.sql completo falla** (limitaciones de pg-mem con PL/pgSQL, `INTERVAL`, etc.; aparece un semicolon doble `); ;` en el mensaje de error del parser tras las transformaciones actuales).
- El sistema **recupera** con esquema mínimo en `db.js` y **seed** con `scripts/initDb.js` — comportamiento correcto para desarrollo.
- **Producción** debe usar **PostgreSQL real** y aplicar `schema.sql` + `npm run db:migrate:run` según corresponda.

**Recomendación técnica:** Ajustar `db.js` (post-procesado del SQL para pg-mem) o un `schema-pgmem.sql` reducido para eliminar el warning y acercar dev a prod.

---

## 7. Frontend vs documentación

- El **README** describe más páginas (usuarios, reportes, configuración) de las que implementa el **frontend mínimo actual** (solo login + listado de computadoras en dashboard).
- Riesgo de **expectativas desalineadas** con stakeholders; documentar explícitamente el alcance del front o ampliar vistas.

---

## 8. Resumen de hallazgos

| Prioridad | Hallazgo |
|-----------|-----------|
| Media | Vulnerabilidades en dependencias (`npm audit` backend y frontend). |
| Media | ESLint sin configuración efectiva en backend. |
| Media | Cobertura de tests centrada en auth y helpers; pocas rutas cubiertas. |
| Baja | Ruido de pg-mem al cargar schema completo (no bloquea dev). |
| Baja | `concurrently` en raíz puede fallar en Windows con un solo comando O por versión. |
| Informativo | Frontend mínimo vs documentación extensa del producto. |

---

## 9. Recomendaciones priorizadas

1. Revisar y mitigar resultados de **`npm audit`** en backend y frontend.  
2. Añadir **configuración ESLint** y, si aplica, hook de CI (GitHub Actions) para `npm test`.  
3. Extender tests de integración (reservas, permisos por rol, settings).  
4. **Producción**: TLS, variables fuera del repo, rotación de `JWT_SECRET`, PostgreSQL con backups.  
5. Sincronizar **README/FUNCIONALIDAD** con el alcance real del frontend o completar pantallas faltantes.

---

*Documento generado en el contexto de la auditoría solicitada; los puertos y el estado del arranque dependen del entorno local.*
