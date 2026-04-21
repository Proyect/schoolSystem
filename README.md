# 🏫 Sistema Escolar - Gestión de Computadoras

Un sistema completo para la gestión de computadoras en laboratorios escolares, con autenticación por roles y interfaz moderna.

## ✨ Características

### 🔐 Autenticación y Autorización
- **Sistema de roles**: Admin, Profesor, Estudiante
- **JWT Tokens** para sesiones seguras
- **Middleware de autorización** por roles
- **Validación de datos** en todas las operaciones

### 💻 Gestión de Computadoras
- **CRUD completo** de computadoras
- **Estados**: Disponible, En Uso, Mantenimiento
- **Búsqueda y filtros** avanzados
- **Paginación** optimizada
- **Auditoría** de cambios

### 📅 Sistema de Reservas
- **Reservas inteligentes** con validación de horarios
- **Gestión de conflictos** automática
- **Estados**: Activa, Completada, Cancelada
- **Verificación de disponibilidad** en tiempo real
- **Duración limitada** y validaciones avanzadas

### 👥 Gestión de Usuarios
- **CRUD completo** de usuarios
- **Roles**: Admin, Profesor, Estudiante
- **Cambio de contraseñas** seguro
- **Estadísticas** de usuarios
- **Permisos granulares** por rol

### 📊 Reportes y Estadísticas
- **Dashboard en tiempo real**
- **Reportes de uso** de computadoras
- **Análisis de reservas** y usuarios
- **Estadísticas por períodos**
- **Exportación de datos**

### ⚙️ Configuración del Sistema
- **Configuraciones dinámicas**
- **Modo de mantenimiento**
- **Logs de auditoría**
- **Gestión de perfiles**
- **Configuraciones de seguridad**

### 🎨 Interfaz Moderna
- **Diseño responsive** con Tailwind CSS
- **Componentes reutilizables**
- **Navegación intuitiva**
- **Notificaciones en tiempo real**
- **Loading states** y manejo de errores

### 🚀 Backend Optimizado
- **Pool de conexiones** PostgreSQL
- **Rate limiting** para seguridad
- **Logging** de operaciones y auditoría
- **Manejo de errores** robusto
- **Validación** de entrada y sanitización
- **Sistema de auditoría** completo
- **Middleware de seguridad** avanzado

## 🛠️ Tecnologías

### Backend
- **Node.js** + **Express.js**
- **PostgreSQL** con **pg** (pool de conexiones)
- **JWT** para autenticación
- **bcryptjs** para encriptación
- **Helmet** para seguridad
- **express-rate-limit** para protección

### Frontend
- **Next.js 15** con App Router
- **React 19** con hooks
- **Tailwind CSS** para estilos
- **Axios** para API calls
- **React Hook Form** para formularios
- **React Hot Toast** para notificaciones
- **Lucide React** para iconos

## 📋 Requisitos Previos

- **Node.js** 18+
- **PostgreSQL 12+** (opcional: puedes usar base en memoria para desarrollo). El esquema usa `EXECUTE PROCEDURE` en triggers para compatibilidad con versiones recientes de PostgreSQL.
- **npm** o **yarn**

**Nota sobre producción:** Los usuarios de ejemplo en `schema.sql` tienen un hash de contraseña fijo. En producción debes crear usuarios con `npm run seed:admin` (backend) o mediante `scripts/initDb.js` (bcrypt real), y no confiar en los INSERT del schema sin reemplazar contraseñas.

---

## 📖 Manual de inicio – Cómo iniciar el sistema

Sigue estos pasos para poner el sistema en marcha en tu máquina.

### Levantar el proyecto con un solo comando

Desde la **raíz del proyecto** puedes usar:

| Método | Comando |
|--------|---------|
| **npm** (recomendado) | `npm install` y luego `npm run dev` |
| **Windows (CMD)** | Doble clic en `start.bat` o `start.bat` en la terminal |
| **Windows (PowerShell)** | `.\start.ps1` |
| **Linux / Mac** | `./start.sh` o `bash start.sh` |

**Comportamiento de `npm run dev`:** Si existe `frontend/school-app`, se levantan backend y frontend. Si no existe, solo se inicia el backend.

La primera vez, instala dependencias en la raíz:

```bash
cd schoolSystem
npm install
npm run dev
```

Se inician el backend (puerto 5051) y, si existe, el frontend (puerto 4001). Abre **http://localhost:4001** si usas frontend o **http://localhost:5051/health** para comprobar el API.

---

### Opción A: Inicio rápido (sin instalar PostgreSQL)

Ideal para desarrollo o pruebas. El backend usa una base de datos en memoria (pg-mem).

1. **Backend**
   ```bash
   cd backend
   npm install
   ```
   Crea el archivo `backend/.env` con al menos:
   ```env
   PORT=5051
   DB_VENDOR=pgmem
   JWT_SECRET=clave_secreta_super_segura
   FRONTEND_URL=http://localhost:4001
   ```
   Luego inicia el servidor:
   ```bash
   npm run dev
   ```
   Verás: `Servidor ejecutándose en http://localhost:5051`. El backend creará usuarios de prueba automáticamente.

2. **Frontend**
   En otra terminal:
   ```bash
   cd frontend/school-app
   npm install
   ```
   Crea `frontend/school-app/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5051/api
   ```
   Inicia la aplicación:
   ```bash
   npm run dev
   ```
   El frontend quedará en **http://localhost:4001**.

3. **Abrir el sistema**
   - Navegador: **http://localhost:4001**
   - Inicia sesión por ejemplo con: `admin@school.com` / `password123`

---

### Opción B: Con PostgreSQL (producción o desarrollo con datos persistentes)

1. **Base de datos**
   - Crea la base: `CREATE DATABASE school_system;`
   - Ejecuta el esquema:
     ```bash
     cd backend
     psql -U postgres -d school_system -f database/schema.sql
     ```
   - Si la base ya existía y le faltan columnas nuevas (ej. número de serie, id hardware):
     ```bash
     psql -U postgres -d school_system -f database/migrations/001_add_serial_hardware_to_computers.sql
     ```

2. **Backend**
   ```bash
   cd backend
   npm install
   ```
   Crea `backend/.env`:
   ```env
   PORT=5051
   NODE_ENV=development
   DATABASE_URL=postgres://usuario:password@localhost:5432/school_system
   JWT_SECRET=tu_super_secret_jwt_key_cambialo_en_produccion
   FRONTEND_URL=http://localhost:4001
   ```
   (Sustituye `usuario` y `password` por los de tu PostgreSQL.)  
   Inicia el servidor:
   ```bash
   npm run dev
   ```
   Crear admin de prueba (opcional):
   ```bash
   npm run seed:admin
   ```

3. **Frontend**
   Igual que en la Opción A:
   ```bash
   cd frontend/school-app
   npm install
   ```
   Crea `.env.local` con `NEXT_PUBLIC_API_URL=http://localhost:5051/api` e inicia:
   ```bash
   npm run dev
   ```

4. **Abrir el sistema**
   - **http://localhost:4001** → login con las credenciales configuradas (ej. `admin@school.com` / `password123` si usaste el seed).

---

### Resumen de puertos y URLs

| Servicio   | URL                      | Uso                    |
|-----------|---------------------------|------------------------|
| Frontend  | http://localhost:4001     | Interfaz web (Next.js) |
| Backend   | http://localhost:5051     | API REST               |
| Health    | http://localhost:5051/health | Comprobar que el API responde |
| API Docs  | http://localhost:5051/api-docs | Swagger UI (solo en desarrollo) |

---

### Comandos útiles

| Acción              | Dónde              | Comando        |
|---------------------|--------------------|----------------|
| Iniciar backend     | `backend/`         | `npm run dev`  |
| Iniciar frontend    | `frontend/school-app/` | `npm run dev` |
| Ejecutar esquema DB | desde `backend/`   | `psql -U postgres -d school_system -f database/schema.sql` |
| Aplicar migraciones | desde `backend/`   | `npm run db:migrate:run` |
| Crear admin (seed)  | `backend/`         | `npm run seed:admin` |
| Tests backend       | desde `backend/`   | `npm test` |

---

## 🚀 Instalación (detalle)

### 1. Clonar el repositorio
```bash
git clone <tu-repositorio>
cd schoolSystem
```

### 2. Configurar Base de Datos

#### Crear base de datos PostgreSQL:
```sql
CREATE DATABASE school_system;
```

#### Ejecutar el esquema:
```bash
cd backend
psql -U postgres -d school_system -f database/schema.sql
```

### 3. Configurar Backend

#### Instalar dependencias:
```bash
cd backend
npm install
```

#### Crear archivo .env:
```env
# Configuración del servidor (el frontend espera el API en 5051)
PORT=5051
NODE_ENV=development

# Base de datos: usa DATABASE_URL o las variables por separado
DATABASE_URL=postgres://postgres:tu_password@localhost:5432/school_system
# Opcional si no usas DATABASE_URL:
# DB_HOST=localhost
# DB_PORT=5432
# DB_NAME=school_system
# DB_USER=postgres
# DB_PASSWORD=tu_password

# JWT (cambiar en producción)
JWT_SECRET=tu_super_secret_jwt_key_aqui_cambialo_en_produccion

# Origen permitido para CORS (debe coincidir con la URL del frontend)
FRONTEND_URL=http://localhost:4001
```

Nota (producción): establece `FRONTEND_URL` al dominio real del frontend (ej. `https://app.midominio.com`) para que CORS permita el origen correcto.

#### Iniciar servidor de desarrollo:
```bash
npm run dev
```

### 4. Configurar Frontend

#### Instalar dependencias:
```bash
cd frontend/school-app
npm install
```

#### Variables de entorno (recomendado)
Crea un archivo `.env.local` en `frontend/school-app/` con:

```env
# URL del backend (puerto 5051 por defecto)
NEXT_PUBLIC_API_URL=http://localhost:5051/api
```

#### Iniciar aplicación:
```bash
npm run dev
```
La aplicación se abrirá en **http://localhost:4001** (puerto por defecto del script `dev`).

## 🔑 Credenciales de Prueba

El sistema incluye usuarios de prueba preconfigurados:

| Rol | Email | Contraseña |
|-----|-------|------------|
| **Admin** | admin@school.com | password123 |
| **Profesor** | teacher@school.com | password123 |
| **Estudiante** | student@school.com | password123 |

## 📱 Uso del Sistema

### 🔐 Inicio de Sesión
1. Ve a **http://localhost:4001** (frontend)
2. Usa las credenciales de prueba (tabla anterior)
3. El sistema te redirigirá automáticamente al dashboard

### 👨‍💼 Panel de Administrador
- **Dashboard**: Estadísticas generales del sistema
- **Computadoras**: Gestión completa (CRUD) con filtros y búsqueda
- **Usuarios**: Gestión de alumnos, profesores y administradores
- **Reservas**: Control total de reservas del sistema
- **Reportes**: Estadísticas avanzadas con gráficos
- **Configuración**: Ajustes del sistema, notificaciones y seguridad

### 👨‍🏫 Panel de Profesor
- **Dashboard**: Vista general de computadoras y estadísticas
- **Computadoras**: Ver y gestionar equipos disponibles
- **Reservas**: Crear y gestionar reservas para clases
- **Reportes**: Ver estadísticas de uso y ocupación

### 👨‍🎓 Panel de Estudiante
- **Dashboard**: Ver computadoras disponibles y estado
- **Computadoras**: Ver estado de equipos en tiempo real
- **Reservas**: Crear y gestionar reservas personales

## 🏗️ Estructura del Proyecto

```
schoolSystem/
├── backend/
│   ├── database/
│   │   └── schema.sql          # Esquema de base de datos
│   ├── middleware/
│   │   ├── auth.js             # Middleware de autenticación
│   │   └── validation.js       # Validación de datos
│   ├── routes/
│   │   ├── auth.js             # Rutas de autenticación
│   │   └── computers.js        # Rutas de computadoras
│   ├── db.js                   # Configuración de base de datos
│   ├── server.js               # Servidor principal
│   └── package.json
├── frontend/
│   └── school-app/
│       ├── src/
│       │   ├── app/
│       │   │   ├── dashboard/   # Dashboard principal
│       │   │   ├── computers/   # Gestión de computadoras
│       │   │   ├── login/       # Página de login
│       │   │   └── layout.js    # Layout principal
│       │   ├── components/
│       │   │   ├── ui/          # Componentes UI
│       │   │   └── Navigation.js # Navegación
│       │   ├── contexts/
│       │   │   └── AuthContext.js # Contexto de autenticación
│       │   └── lib/
│       │       └── api.js       # Configuración de API
│       └── package.json

### Reservas
- `GET /api/reservations` - Listar reservas (con filtros)
- `GET /api/reservations/:id` - Obtener reserva específica
- `POST /api/reservations` - Crear reserva
- `PATCH /api/reservations/:id/status` - Actualizar estado de reserva
- `DELETE /api/reservations/:id` - Eliminar reserva (Admin)
- `GET /api/reservations/computers/:id/availability` - Ver disponibilidad

### Usuarios
- `GET /api/users` - Listar usuarios (Admin)
- `POST /api/users` - Crear usuario (Admin)
- `PUT /api/users/:id` - Actualizar usuario
- `PATCH /api/users/:id/password` - Cambiar contraseña
- `DELETE /api/users/:id` - Eliminar usuario (Admin)
- `GET /api/users/stats/overview` - Estadísticas de usuarios

### Reportes
- `GET /api/reports/computers` - Reporte de computadoras
- `GET /api/reports/reservations` - Reporte de reservas
- `GET /api/reports/users` - Reporte de usuarios (Admin)
- `GET /api/reports/dashboard` - Dashboard en tiempo real
- `GET /api/reports/export/:type` - Exportar datos

### Configuración
- `GET /api/settings` - Obtener configuraciones (Admin)
- `PUT /api/settings/:key` - Actualizar configuración (Admin)
- `PUT /api/settings` - Actualizar múltiples configuraciones (Admin)
- `POST /api/settings` - Crear configuración (Admin)
- `DELETE /api/settings/:key` - Eliminar configuración (Admin)
- `GET /api/settings/audit-logs` - Logs de auditoría (Admin)
- `GET /api/settings/system-stats` - Estadísticas del sistema (Admin)

## 🚀 Optimizaciones Implementadas

### Backend
- ✅ **Pool de conexiones** PostgreSQL optimizado
- ✅ **Rate limiting** para prevenir ataques
- ✅ **Validación** y sanitización de datos
- ✅ **Manejo de errores** robusto
- ✅ **Logging** y auditoría completa
- ✅ **Middleware de seguridad** (Helmet + custom)
- ✅ **Autenticación JWT** con roles
- ✅ **Paginación** en consultas
- ✅ **Índices** optimizados en base de datos
- ✅ **Sistema de configuración** dinámico
- ✅ **Detección de actividad** sospechosa
- ✅ **API RESTful** completa y documentada

### Frontend
- ✅ **Context API** para estado global
- ✅ **Componentes reutilizables** y modulares
- ✅ **Manejo de errores** con toast
- ✅ **Loading states** optimizados
- ✅ **Responsive design** completo
- ✅ **Navegación** por roles y permisos
- ✅ **Formularios** con validación avanzada
- ✅ **Interceptores** de API inteligentes
- ✅ **Interfaces completas** para todas las funcionalidades
- ✅ **Dashboard** interactivo con estadísticas
- ✅ **Sistema de reportes** visual
- ✅ **Gestión de configuración** administrativa

## 🔒 Seguridad

- **JWT Tokens** con expiración automática
- **Contraseñas encriptadas** con bcrypt
- **Rate limiting** para prevenir ataques DDoS
- **Validación** y sanitización de datos de entrada
- **CORS** configurado correctamente
- **Headers de seguridad** con Helmet
- **Sistema de auditoría** completo con logs
- **Detección de actividad** sospechosa
- **Middleware de seguridad** personalizado
- **Protección contra XSS** y injection
- **Roles y permisos** granulares
- **Monitoreo** de seguridad en tiempo real

## 🐛 Solución de Problemas

### Error de conexión a base de datos
```bash
# Verificar que PostgreSQL esté corriendo
sudo service postgresql status

# Verificar credenciales en .env
# Asegurarse de que la base de datos existe
```

### Error de dependencias
```bash
# Limpiar cache de npm
npm cache clean --force

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
```

### Error de puertos
```bash
# Verificar puertos en uso (frontend 4001, backend 5051)
lsof -i :4001
lsof -i :5051

# Cambiar PORT en backend/.env y NEXT_PUBLIC_API_URL en frontend si es necesario
```

## ✅ Funcionalidades Completadas

- [x] **Sistema de reservas** completo con validaciones
- [x] **Gestión de usuarios** con roles y permisos
- [x] **Reportes y estadísticas** avanzados
- [x] **Sistema de auditoría** y logging
- [x] **Configuración dinámica** del sistema
- [x] **Middleware de seguridad** avanzado
- [x] **Validaciones** y sanitización de datos
- [x] **Interfaz moderna** y responsive
- [x] **API RESTful** completa y documentada

## 📈 Posibles Mejoras Futuras

- [ ] **Notificaciones** push en tiempo real
- [ ] **Backup automático** de base de datos
- [ ] **Tests** unitarios y de integración
- [ ] **Docker** para despliegue
- [ ] **PWA** para acceso móvil
- [ ] **Exportación** de datos a Excel/PDF
- [ ] **API GraphQL** alternativa
- [ ] **Módulo de inventario** avanzado

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📄 Licencia

Este proyecto está bajo la Licencia MIT - ver el archivo [LICENSE](LICENSE) para detalles.

## 📞 Soporte

Si tienes problemas o preguntas:

1. Revisa la sección de [Solución de Problemas](#-solución-de-problemas)
2. Busca en los [Issues](../../issues) existentes
3. Crea un nuevo issue con detalles del problema

---

**¡Disfruta usando el Sistema Escolar! 🎓** 