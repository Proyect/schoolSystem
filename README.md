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

### 🎨 Interfaz Moderna
- **Diseño responsive** con Tailwind CSS
- **Componentes reutilizables**
- **Navegación intuitiva**
- **Notificaciones en tiempo real**
- **Loading states** y manejo de errores

### 🚀 Backend Optimizado
- **Pool de conexiones** PostgreSQL
- **Rate limiting** para seguridad
- **Logging** de operaciones
- **Manejo de errores** robusto
- **Validación** de entrada

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
- **PostgreSQL** 12+
- **npm** o **yarn**

## 🚀 Instalación

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
```bash
# Configuración del servidor
PORT=5000
NODE_ENV=development

# Configuración de base de datos PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=school_system
DB_USER=postgres
DB_PASSWORD=tu_password

# Configuración JWT
JWT_SECRET=tu_super_secret_jwt_key_aqui_cambialo_en_produccion

# Configuración del frontend
FRONTEND_URL=http://localhost:3000
```

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

#### Iniciar aplicación:
```bash
npm run dev
```

## 🔑 Credenciales de Prueba

El sistema incluye usuarios de prueba preconfigurados:

| Rol | Email | Contraseña |
|-----|-------|------------|
| **Admin** | admin@school.com | password123 |
| **Profesor** | teacher@school.com | password123 |
| **Estudiante** | student@school.com | password123 |

## 📱 Uso del Sistema

### 🔐 Inicio de Sesión
1. Ve a `http://localhost:3000`
2. Usa las credenciales de prueba
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
└── README.md
```

## 🔧 API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/verify` - Verificar token

### Computadoras
- `GET /api/computers` - Listar computadoras (con paginación)
- `GET /api/computers/:id` - Obtener computadora específica
- `POST /api/computers` - Crear computadora (Admin/Teacher)
- `PATCH /api/computers/:id/status` - Actualizar estado
- `DELETE /api/computers/:id` - Eliminar computadora (Admin)

## 🚀 Optimizaciones Implementadas

### Backend
- ✅ **Pool de conexiones** PostgreSQL optimizado
- ✅ **Rate limiting** para prevenir ataques
- ✅ **Validación** de datos de entrada
- ✅ **Manejo de errores** robusto
- ✅ **Logging** de operaciones
- ✅ **Middleware de seguridad** (Helmet)
- ✅ **Autenticación JWT** con roles
- ✅ **Paginación** en consultas
- ✅ **Índices** en base de datos

### Frontend
- ✅ **Context API** para estado global
- ✅ **Componentes reutilizables**
- ✅ **Manejo de errores** con toast
- ✅ **Loading states** optimizados
- ✅ **Responsive design** completo
- ✅ **Navegación** por roles
- ✅ **Formularios** con validación
- ✅ **Interceptores** de API

## 🔒 Seguridad

- **JWT Tokens** con expiración
- **Contraseñas encriptadas** con bcrypt
- **Rate limiting** para prevenir spam
- **Validación** de datos de entrada
- **CORS** configurado correctamente
- **Headers de seguridad** con Helmet

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
# Verificar puertos en uso
lsof -i :3000
lsof -i :5000

# Cambiar puertos en .env si es necesario
```

## 📈 Próximas Mejoras

- [ ] **Sistema de reservas** completo
- [ ] **Notificaciones** en tiempo real
- [ ] **Reportes** avanzados
- [ ] **Backup automático** de base de datos
- [ ] **Tests** unitarios y de integración
- [ ] **Docker** para despliegue
- [ ] **PWA** para acceso móvil
- [ ] **Exportación** de datos a Excel/PDF

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