# 🏔️ Plataforma de Seguridad en Montaña - Backend

API REST completa para una plataforma de seguridad en montaña con gestión de zonas, datos meteorológicos, reportes comunitarios y orientación asistida por IA.

## 🏗️ Arquitectura MVC + MongoDB Native

Este proyecto implementa una **arquitectura en capas (MVC)** con patrones nativos de MongoDB para máxima eficiencia.

### Estructura del Proyecto

```
src/
├── index.js                      # Punto de entrada
├── config/
│   ├── database.js              # Conexión MongoDB
│   ├── logger.js                # Winston logger
│   └── swagger.js               # OpenAPI spec
├── models/                       # Esquemas Mongoose
│   ├── User.js                  # Usuarios (preferencias embebidas)
│   ├── Zone.js                  # Zonas con GeoJSON
│   ├── Report.js                # Reportes (categoría + comentarios embebidos)
│   ├── Comment.js               # Comentarios de zona
│   └── SystemMetric.js          # Métricas del sistema
├── services/                     # 🆕 Lógica de negocio (pura)
│   ├── userService.js           # Gestión de usuarios
│   ├── reportService.js         # Operaciones de reportes
│   ├── commentService.js        # Gestión de comentarios
│   └── zoneService.js           # Datos de zonas
├── controllers/                  # 🆕 Handlers HTTP
│   ├── userController.js        # Mapeo HTTP → userService
│   ├── reportController.js      # Mapeo HTTP → reportService
│   ├── commentController.js     # Mapeo HTTP → commentService
│   └── zoneController.js        # Mapeo HTTP → zoneService
├── routes/                       # Validación + delegación
│   ├── auth.js                  # Autenticación
│   ├── users.js                 # Usuarios y favoritos
│   ├── zones.js                 # Gestión de zonas
│   ├── reports.js               # CRUD de reportes
│   ├── comments.js              # Comentarios
│   ├── chat.js                  # ChatBot IA
│   └── admin.js                 # Administración
├── middleware/
│   ├── errorHandler.js          # Manejo global de errores
│   └── httpLogger.js            # Logger de HTTP
├── utils/
│   └── query.js                 # Utilidades BD
└── test/
    ├── auth.rest                # 🆕 Autenticación
    ├── users.rest               # 🆕 Usuarios
    ├── zones.rest               # 🆕 Zonas
    ├── reports.rest             # 🆕 Reportes  
    ├── comments.rest            # 🆕 Comentarios
    └── admin.rest               # 🆕 Administración
```

---

## 🎯 Características Principales

✅ **Autenticación y Autorización**
- Registro e inicio de sesión
- Roles (PUBLIC, USER, ADMIN)

✅ **Gestión de Zonas**
- Zonas geográficas con GeoJSON
- Datos meteorológicos en caché
- Dashboards con estadísticas

✅ **Reportes Comunitarios (MongoDB Native)**
- Categoría embebida (sin referencias)
- Comentarios embebidos en reportes
- Validación basada en reputación
- Auto-eliminación después de 48h (TTL)

✅ **Preferencias de Usuario (MongoDB Native)**
- Array de favoritos con config embebida
- Configuración de alertas por zona
- Métodos de notificación personalizados

✅ **Sistema Social**
- Comentarios en foro por zona
- Comentarios embebidos en reportes
- Reputación y medallas de usuario

✅ **Monitoreo del Sistema**
- Métricas en tiempo real
- Análisis de uso de API
- Estado de salud

---

## 🚀 Instalación y Configuración

### Requisitos
- Node.js >= 14
- MongoDB >= 4.4

### Instalación

```bash
# Clonar repositorio
git clone <repo>
cd MeteoMap-Backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Iniciar servidor
npm run dev        # Desarrollo (con nodemon)
npm start          # Producción
```

### Variables de Entorno (.env)

```env
# Servidor
PORT=3000
NODE_ENV=development

# Base de datos
MONGODB_URI=mongodb://localhost:27017

# Logging
LOG_LEVEL=info
```

---

## 📚 Documentación de API

### Swagger/OpenAPI
```
http://localhost:3000/docs
```

### Health Check
```bash
curl http://localhost:3000/health
```

---

## 📋 Endpoints Principales

### Autenticación (`test/auth.rest`)
```
POST   /api/auth/register         # Registrar usuario
POST   /api/auth/login            # Iniciar sesión
```

### Usuarios (`test/users.rest`)
```
GET    /api/user/profile/:userId                    # Obtener perfil
PUT    /api/user/favorites                          # Agregar/remover favorito
PATCH  /api/user/alerts/:userId/:zoneId            # Actualizar alertas
```

### Zonas (`test/zones.rest`)
```
GET    /api/zones                  # Listar todas
GET    /api/zones/:id              # Obtener una zona
GET    /api/zones/:id/weather      # Datos meteorológicos
GET    /api/zones/:id/dashboard    # Estadísticas
```

### Reportes (`test/reports.rest`)
```
GET    /api/reports                # Listar reportes
GET    /api/reports/:id            # Obtener reporte
POST   /api/reports                # Crear reporte
PATCH  /api/reports/:id/validate   # Confirmar/desmentir
DELETE /api/reports/:id            # Eliminar reporte
```

### Comentarios (`test/comments.rest`)
```
GET    /api/comments/:zoneId                        # Comentarios de zona
GET    /api/comments/report/:reportId/comments      # Comentarios embebidos
POST   /api/comments                                 # Crear comentario
DELETE /api/comments/:id                            # Eliminar comentario (zona)
DELETE /api/comments/report/:reportId/comments/:idx # Eliminar embebido
```

### Chat/IA
```
POST   /api/chat/ask               # Preguntar al asistente IA
```

### Administración (`test/admin.rest`)
```
GET    /api/admin/metrics          # Métricas del sistema
GET    /api/admin/health           # Estado de salud
```

---

## 📊 Esquema de Base de Datos (MongoDB Native)

### Colección: users
```javascript
{
  _id: ObjectId,
  datos_acceso: {
    email: String (unique),
    password_hash: String,
    rol: "PUBLIC" | "USER" | "ADMIN"
  },
  perfil: {
    nombre: String,
    avatar_url: String
  },
  preferencias: [
    {
      zona_id: ObjectId,
      configuracion_alertas: {
        aludes: { activo: Boolean, umbral_nivel: Number },
        viento: { activo: Boolean, umbral_kmh: Number },
        reportes_comunidad: { 
          activo: Boolean, 
          tipos_suscritos: [String]
        }
      },
      metodo_notificacion: "PUSH" | "EMAIL" | "SMS" | "NINGUNO",
      fecha_agregada: Date
    }
  ],
  limites_ia: {
    peticiones_hoy: Number,
    ultimo_reset: Date
  },
  estado: "ACTIVO" | "BLOQUEADO",
  reputacion: {
    puntos: Number,
    medalla: String,
    strikes_spam: Number
  },
  timestamps: true
}
```

### Colección: reports
```javascript
{
  _id: ObjectId,
  usuario_id: ObjectId (ref User),
  zona_id: ObjectId (ref Zone),
  categoria: {
    nombre: String,
    icono_marcador: String
  },
  geolocalizacion: {
    type: "Point",
    coordinates: [Number, Number]  // [Longitud, Latitud]
  },
  tipo: String,
  contenido: {
    descripcion: String,
    foto_url: String
  },
  validaciones: {
    confirmaciones: Number,
    desmentidos: Number
  },
  estado: "PENDIENTE" | "ACTIVO" | "OCULTO" | "SPAM",
  valoracion_global: Number,
  comentarios: [ 
    {
      usuario_id: ObjectId,
      autor_nombre: String,
      contenido: String,
      etiqueta: String,
      estado: "ACTIVO" | "SPAM" | "ELIMINADO",
      fecha: Date
    }
  ],
  createdAt: Date (TTL index: 172800s / 48h),
  updatedAt: Date
}
```

### Colección: comments
```javascript
{
  _id: ObjectId,
  usuario_id: ObjectId (ref User),
  zona_id: ObjectId (ref Zone),
  reporte_id: ObjectId | null (ref Report),
  contenido: String,
  etiqueta: String,
  estado: "ACTIVO" | "SPAM" | "ELIMINADO",
  timestamps: true
}
```

### Colección: zones
```javascript
{
  _id: ObjectId,
  nombre: String,
  descripcion: String,
  geolocalizacion: {
    type: "Point",
    coordinates: [Number, Number]
  },
  cache_meteo: {},
  estado: "ACTIVA" | "INACTIVA",
  timestamps: true
}
```

---

## 🏛️ Patrón MVC Explicado

### 1. **Models** (src/models/)
- Esquemas Mongoose
- Validaciones BD
- Índices y hooks

### 2. **Services** (src/services/) ⭐ CAPA DE NEGOCIO
```javascript
// Lógica PURA (sin conocimiento de HTTP)
class UserService {
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("Usuario no encontrado");
    return { id: user._id, email: user.email, ... };
  }
}
```

**Ventajas:**
- ✅ Testeable sin mocks HTTP
- ✅ Reutilizable (CLI, Jobs, etc.)
- ✅ Lógica centralizada

### 3. **Controllers** (src/controllers/) ⭐ CAPA HTTP
```javascript
// Thin controller (solo mapeo HTTP)
class UserController {
  async getProfile(req, res, next) {
    try {
      const profile = await userService.getProfile(req.params.userId);
      res.json(profile);
    } catch (err) {
      next(err);
    }
  }
}
```

**Ventajas:**
- ✅ Separación de responsabilidades
- ✅ Fácil de testear (inyectar service mock)
- ✅ Código limpio

### 4. **Routes** (src/routes/)
```javascript
// Validación + delegación
router.get(
  "/profile/:userId",
  [param("userId").isMongoId()],
  validate,
  (req, res, next) => userController.getProfile(req, res, next)
);
```

### Flujo de una Request
```
Request → Route (validación) → Controller → Service → Database
                                                          ↓
Response ← Controller (formato) ← Service (resultado) ← Query
```

---

## 🧪 Testing - Endpoints Organizados

### Usar con VS Code REST Client

**Extensión:** [humao.rest-client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)

#### Archivos de Test

| Archivo | Endpoints |
|---------|-----------|
| `test/auth.rest` | Register, Login |
| `test/users.rest` | Profile, Favorites, Alerts |
| `test/zones.rest` | List, Get, Weather, Dashboard |
| `test/reports.rest` | CRUD, Validate |
| `test/comments.rest` | Zone comments, Report comments |
| `test/admin.rest` | Health, Metrics |

#### Ejemplo: Crear un Reporte

```rest
POST http://localhost:3000/api/reports
Content-Type: application/json

{
  "usuario_id": "652a1b2c3d4e5f6g7h8i9j0k",
  "zona_id": "652a1b2c3d4e5f6g7h8i9j0k",
  "nombre_categoria": "Avalancha",
  "icono_marcador": "⚠️",
  "tipo": "Avalancha",
  "descripcion": "Avalancha vista en la cara norte",
  "coordinates": [-5.0, 43.25]
}
```

---

## 🔒 Manejo de Errores

Todas las respuestas de error siguen este formato:

```json
{
  "error": "Mensaje de error",
  "errors": [
    {
      "field": "nombreDelCampo",
      "message": "detalles del error"
    }
  ]
}
```

El middleware `errorHandler.js` captura todos los errores automáticamente.

---

## 🚀 Próximos Pasos

- [ ] Agregar Unit Tests (Jest)
- [ ] Agregar Integration Tests
- [ ] Authenticación JWT
- [ ] Hashing de contraseñas (bcrypt)
- [ ] Rate limiting
- [ ] Integración API meteorológica (AEMET/Open-Meteo)
- [ ] Integración ChatGPT/Claude
- [ ] Notificaciones por email/SMS
- [ ] WebSockets para updates en tiempo real

---

## 🔧 Stack Tecnológico

- **Runtime:** Node.js
- **API Framework:** Express.js
- **Base de Datos:** MongoDB + Mongoose
- **Validación:** express-validator
- **Logging:** Winston
- **Documentación:** Swagger/OpenAPI
- **Testing:** REST Client (VS Code)

---

## 📝 Licencia

ISC
