# Control de funcionalidad del sistema

Resumen de lo revisado y corregido para que todo el sistema funcione de forma coherente.

---

## Backend

### Rutas montadas
- **`/api/auth`** – Login, verify (rate limit específico).
- **`/api/computers`** – CRUD y listado con paginación; **GET requiere autenticación**.
- **`/api/reservations`** – **Añadido** (antes no estaba montado). Listado, creación, actualización de estado, eliminación, disponibilidad por computadora y fecha.
- **`/api/users`** – CRUD, estadísticas (`GET /stats/overview`), cambio de contraseña (solo admin o propio usuario).
- **`/api/reports`** – Reportes de computadoras, reservas, usuarios, dashboard y exportación (admin/teacher).
- **`/api/settings`** – Configuración del sistema (solo admin).

### Cambios realizados
1. **server.js**: Montada la ruta `app.use("/api/reservations", reservationRoutes)`.
2. **computers.js**: Añadido middleware `auth` a `GET /` y `GET /:id` para que solo usuarios autenticados puedan listar/ver computadoras.
3. **reservations.js**: Ruta `GET /computers/:computer_id/availability` – validación de `computer_id` (numérico) y uso de `computerIdNum` en las consultas; eliminado `validateParams` que no aplica a `computer_id`.
4. **validation.js**: Límite máximo de `limit` en query aumentado de 100 a **1000** (dashboard y listados grandes).
5. **initDb.js**: Inserción por defecto de filas en **system_settings** (max_reservation_hours, advance_booking_days, max_active_reservations, auto_logout_minutes, maintenance_mode) cuando la tabla está vacía en pg-mem.

---

## Frontend

### Páginas y permisos
| Ruta           | Roles              | Comportamiento |
|----------------|--------------------|----------------|
| `/login`       | Público            | Login; redirección a `/dashboard` si ya hay sesión. |
| `/dashboard`   | admin, teacher, student | Estadísticas de computadoras (totales por estado). |
| `/computers`   | admin, teacher, student | Listado, filtros, cambio de estado, alta/baja (admin/teacher). |
| `/reservations`| admin, teacher, student | Listado, filtros, crear reserva, cambiar estado; estudiantes solo ven las suyas. |
| `/users`       | **admin**          | CRUD usuarios, estadísticas, cambio de contraseña. |
| `/reports`     | **admin, teacher** | Dashboard de reportes, reportes por computadoras/reservas/usuarios, exportación. |
| `/settings`    | Todos (contenido por rol) | Perfil y seguridad para todos; pestañas Sistema/Mantenimiento solo **admin**. |

### Cambios realizados
1. **users/page.js**: Corrección de **Rules of Hooks** – el `return` de “Acceso denegado” se movió **después** de todos los hooks (useState, useForm, useEffect). El `useEffect` solo hace fetch si `hasRole(['admin'])`. Uso de `watchPassword` para validar confirmación de contraseña en el modal.
2. **reports/page.js**: Misma corrección de **Rules of Hooks** – el `return` de “Acceso denegado” va después de los `useEffect`.
3. **settings/page.js**:
   - Carga de configuración del sistema desde **settingsAPI** cuando el usuario es admin.
   - Guardado en backend al cambiar opciones (duración máxima reserva, días de anticipación, reservas activas máximas, auto-logout, modo mantenimiento) mediante **settingsAPI.update** con mapeo de claves (camelCase ↔ snake_case).

---

## Flujo de datos

- **Auth**: Token en `localStorage`; interceptor de axios añade `Authorization: Bearer <token>`; en 401 se limpia sesión y se redirige a `/login`.
- **Computadoras**: Listado y detalle requieren auth; creación/actualización de estado/eliminación según rol (admin/teacher).
- **Reservas**: Todas las operaciones requieren auth; estudiantes solo ven/modifican sus reservas; disponibilidad en `GET /api/reservations/computers/:computer_id/availability?date=YYYY-MM-DD`.
- **Usuarios**: Solo admin lista, crea, edita, elimina y ve estadísticas; cambio de contraseña: admin sin contraseña actual, resto con contraseña actual.
- **Reportes**: Solo admin y teacher; dashboard y exportación según permisos.
- **Configuración**: Perfil y contraseña para todos; configuración del sistema (tabla `system_settings`) solo admin, con lectura/escritura vía API.

---

## Cómo probar

1. **Backend** (desde `backend`):  
   `$env:DB_VENDOR='pgmem'; $env:PORT='5051'; npm run dev`
2. **Frontend** (desde `frontend/school-app`):  
   `$env:NEXT_PUBLIC_API_URL='http://localhost:5051/api'; npm run dev`
3. Login: `admin@school.com` / `password123` (o teacher/student).
4. Navegar: Dashboard, Computadoras, Reservas, Usuarios (admin), Reportes (admin/teacher), Configuración (perfil y, como admin, Sistema).

Con estos cambios, la funcionalidad del sistema queda controlada de extremo a extremo: rutas montadas, auth en backend, hooks correctos en frontend y configuración del sistema cargada/guardada vía API.
