# Plataforma de Seguridad en Montaña - Backend

Este proyecto backend proporciona una REST API completa para una plataforma de seguridad en montaña con gestión de zonas, datos meteorológicos, reportes comunitarios y orientación asistida por IA.

## Estructura del Proyecto

```
src/
├── index.js                 # Punto de entrada de la aplicación
├── config/
│   ├── database.js         # Configuración de conexión a MongoDB
│   ├── logger.js           # Configuración de logger Winston
│   └── swagger.js          # Especificación Swagger/OpenAPI
├── models/                 # Esquemas de Mongoose
│   ├── User.js            # Esquema de usuario con roles y reputación
│   ├── Zone.js            # Zonas de montaña con GeoJSON
│   ├── Report.js          # Reportes comunitarios con validación
│   ├── Comment.js         # Comentarios y discusiones en foro
│   ├── ReportCategory.js  # Tipos/categorías de reportes
│   ├── SystemMetric.js    # Métricas de rendimiento del sistema
│   └── FavoriteZone.js    # Zonas favoritas del usuario
├── routes/                # Implementación de endpoints
│   ├── auth.js            # Autenticación (registro, login)
│   ├── users.js           # Gestión de usuarios (perfil, favoritos)
│   ├── zones.js           # Gestión de zonas (listar, clima, dashboard)
│   ├── reports.js         # Operaciones CRUD de reportes y validación
│   ├── comments.js        # Comentarios y endpoints del foro
│   ├── chat.js            # Integración del chatbot IA
│   └── admin.js           # Panel de administración (métricas, usuarios)
├── middleware/
│   ├── errorHandler.js    # Manejo global de errores
│   └── httpLogger.js      # Registro de solicitudes HTTP
└── utils/
│   └── query.js           # Utilidades de consultas de base de datos
└── test/
    └── requests.rest      # Ejemplo de pruebas
```

## Características

✅ **Autenticación y Autorización**
- Registro e inicio de sesión de usuarios
- Control de acceso basado en roles (PUBLIC, USER, ADMIN)

✅ **Gestión de Zonas**
- Zonas geográficas con soporte GeoJSON
- Almacenamiento en caché de datos meteorológicos
- Análisis y dashboards

✅ **Reportes Comunitarios**
- Envío de reportes con geolocalización
- Sistema de validación basado en reputación
- Auto-eliminación basada en TTL (48 horas)

✅ **Características Sociales**
- Perfiles de usuario con puntuaciones de reputación
- Comentarios en foro por zona
- Zonas favoritas con alertas personalizadas

✅ **Monitoreo del Sistema**
- Seguimiento de métricas en tiempo real
- Análisis de uso de la API
- Estado de salud del sistema

✅ **Panel de Administración**
- Gestión y bloqueo de usuarios
- Gestión de categorías de reportes
- Análisis y métricas del sistema

## Instalación

```bash
# Instalar dependencias
npm install

# Modo desarrollo (con recarga automática)
npm run dev

# Modo producción
npm start
```

## Configuración

Crear un archivo `.env` en la raíz del proyecto:

```env
# Servidor
PORT=3000

# Base de datos
MONGODB_URI=mongodb://localhost:27017/
MONGODB_COLLECTION_USERS=users
MONGODB_COLLECTION_ZONES=zones
MONGODB_COLLECTION_REPORTS=reports
MONGODB_COLLECTION_CATEGORIES=report_categories
MONGODB_COLLECTION_COMMENTS=comments
MONGODB_COLLECTION_METRICS=system_metrics
MONGODB_COLLECTION_FAVORITES=favorite_zones

# Logging
LOG_LEVEL=info
```

## Documentación de la API

Una vez que el servidor esté en ejecución, visite:
- **Swagger UI:** http://localhost:3000/docs
- **JSON OpenAPI:** http://localhost:3000/docs.json
- **Verificación de salud:** http://localhost:3000/health

La referencia detallada de endpoints está disponible en [API_ENDPOINTS.md](./API_ENDPOINTS.md)

## Endpoints Principales

### Autenticación
- `POST /api/auth/register` - Registrar nuevo usuario
- `POST /api/auth/login` - Iniciar sesión

### Gestión de Usuarios
- `GET /api/user/profile/:userId` - Obtener perfil de usuario
- `PUT /api/user/favorites` - Gestionar zonas favoritas

### Zonas
- `GET /api/zones` - Listar todas las zonas
- `GET /api/zones/:id/weather` - Obtener datos meteorológicos
- `GET /api/zones/:id/dashboard` - Obtener análisis

### Reportes
- `GET /api/reports` - Listar reportes
- `POST /api/reports` - Crear reporte
- `PATCH /api/reports/:id/validate` - Validar reporte
- `DELETE /api/reports/:id` - Eliminar reporte

### Comentarios
- `GET /api/comments/:zoneId` - Obtener comentarios de la zona
- `POST /api/comments` - Publicar comentario

### Chat/IA
- `POST /api/chat/ask` - Hacer preguntas a la IA

### Administración
- `GET /api/admin/metrics` - Métricas del sistema
- `PATCH /api/admin/users/:id/block` - Bloquear usuario
- `POST /api/admin/categories` - Crear categoría de reporte

## Esquema de Base de Datos

La aplicación utiliza 7 colecciones principales:

1. **Usuarios** - Cuentas de usuario con roles y reputación
2. **Zonas** - Zonas de montaña con coordenadas GeoJSON
3. **Reportes** - Reportes comunitarios con sistema de validación
4. **Comentarios** - Comentarios de foro en zonas
5. **Categorías de Reportes** - Tipos de reportes (Avalanchas, Hielo, Viento, etc.)
6. **Métricas del Sistema** - Seguimiento de rendimiento y uso
7. **Zonas Favoritas** - Zonas favoritas de usuario con configuración de alertas

Para definiciones de esquema detalladas, consulte los archivos de modelo en `src/models/`.

## Manejo de Errores

Todos los errores devuelven JSON en este formato:

```json
{
  "error": "Mensaje de error",
  "errors": [
    {
      "field": "nombreDelCampo",
      "message": "detalles del error de validación"
    }
  ]
}
```

## Registro (Logging)

La aplicación utiliza Winston para logging con diferentes niveles:
- **error** - Errores críticos
- **warn** - Advertencias
- **info** - Información general
- **debug** - Detalles de depuración

Los registros se escriben en el directorio `logs/`.

## Mejoras Futuras

⏳ TODO - Hashing de contraseñas con bcrypt
⏳ TODO - Generación y validación de tokens JWT
⏳ TODO - Integración de servicio IA (OpenAI, Claude)
⏳ TODO - Integración de API meteorológica (AEMET, Open-Meteo)
⏳ TODO - Sistema de notificaciones por correo
⏳ TODO - Notificaciones push
⏳ TODO - Middleware de autenticación de usuario
⏳ TODO - Limitador de velocidad (Rate limiting)

## Desarrollo

Para desarrollo local:

```bash
# Iniciar MongoDB
mongod

# Instalar dependencias
npm install

# Ejecutar en modo desarrollo
npm run dev

# Verificar la API
curl http://localhost:3000/health
```

## Licencia

ISC
