# Arquitectura de la Plataforma Mountain Safety

## 1. Estructura General de la Aplicación

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Cliente)                      │
│                   (React)                                   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                        HTTP/REST API
                               │
┌──────────────────────────────┴──────────────────────────────┐
│                   Node.js/Express Backend                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Express Server (Port 3000)                 │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │              API Routes                          │  │ │
│  │  ├─ /api/auth        (Autenticación)               │  │ │
│  │  ├─ /api/user        (Perfil y favoritos)          │  │ │
│  │  ├─ /api/zones       (Zonas y meteorología)        │  │ │
│  │  ├─ /api/reports     (Reportes de comunidad)       │  │ │
│  │  ├─ /api/comments    (Foros y comentarios)         │  │ │
│  │  ├─ /api/chat        (Asistente IA)                │  │ │
│  │  ├─ /api/admin       (Panel administrativo)        │  │ │
│  │  └─ /health          (Health check)                │  │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │         Middleware & Utilidades                  │  │ │
│  │  ├─ Validator (express-validator)                  │  │ │
│  │  ├─ Logger (Winston)                               │  │ │
│  │  ├─ Error Handler                                  │  │ │
│  │  └─ CORS & Security (Helmet)                       │  │ │
│  │  ┌─────────────────────────────────────────────────┐  │ │
│  │  │           Mongoose Models                        │  │ │
│  │  ├─ User      (Usuarios y roles)                   │  │ │
│  │  ├─ Zone      (Zonas geográficas)                  │  │ │
│  │  ├─ Report    (Reportes de comunidad)              │  │ │
│  │  ├─ Comment   (Comentarios/foros)                  │  │ │
│  │  ├─ ReportCategory (Tipos de reportes)            │  │ │
│  │  ├─ SystemMetric (Métricas del sistema)            │  │ │
│  │  └─ FavoriteZone (Favoritos del usuario)           │  │ │
│  │  └─────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└────────────┬─────────────────────────────────┬──────────────┘
             │                                 │
        MongoDB                    APIs Externas (Futuro)
        Database                   - AEMET (Meteorología)
                                   - OpenAI/Claude (IA)
                                   - SendGrid (Email)
```

---

## 2. Flujo de Autenticación

```
┌─────────────────┐
│    USUARIO      │
└────────┬────────┘
         │
         ├─────────────────────────────────────────────────┐
         │                                                 │
         ▼                                                 ▼
    REGISTRO                                          LOGIN
    POST /api/auth/register                    POST /api/auth/login
    │                                           │
    ├─ Validar email único                     ├─ Validar credenciales
    ├─ Hash password (TODO: bcrypt)            ├─ Verificar estado (ACTIVO)
    ├─ Crear usuario                           ├─ Generar JWT (TODO)
    └─ Guardar en BD                           └─ Retornar token + user data
         │                                           │
         └─────────────────┬──────────────────────────┘
                           │
                           ▼
                  ┌────────────────────┐
                  │   TOKEN + DATOS    │
                  │    AL FRONTEND     │
                  └────────────────────┘
```

---

## 3. Flujo de Reportes de Comunidad

```
┌──────────────────────┐
│   USUARIO REPORTA    │
│    ACONTECIMIENTO    │
└──────────┬───────────┘
           │ POST /api/reports
           │ {usuario_id, zona_id, tipo, descripcion, coords, foto}
           ▼
    ┌─────────────────┐
    │   VALIDACIÓN    │
    │ - Usuario existe│
    │ - Coords válidas│
    │ - Descripción OK│
    └────────┬────────┘
             │
             ▼ GUARDAR EN BD
    ┌──────────────────────┐    OTROS USUARIOS
    │   REPORTE PENDIENTE  │◄──────────────┐
    │  estado: PENDIENTE   │               │
    │  confirmaciones: 0   │               │
    │  desmentidos: 0      │               │
    └────────┬─────────────┘               │
             │                            │
             ├──────────────────────────┬─┴──────────┐
             │                          │            │
             ▼                          ▼            ▼
        MOSTRAR EN      PATCH /validate   PATCH /validate
        MAPA/LISTADO    (confirmar)       (desmentir)
                        confirmaciones++  desmentidos++
                             │                 │
                             └────────┬────────┘
                                      │
                                      ▼
                         ┌──────────────────────────┐
                         │  CALCULAR PUNTUACIÓN     │
                         │  global = conf - desm    │
                         │  Si < -3 → estado OCULTO │
                         └──────────────────────────┘
                                      │
                         ┌────────────┴─────────────┐
                         │                          │
                    global >= -3              global < -3
                         │                          │
                         ▼                          ▼
                  estado: ACTIVO           estado: OCULTO
                  (Visible en mapa)        (Oculto de usuarios)
```

---

## 4. Sistema de Reputación del Usuario

```
┌─────────────────────────────────────────────────┐
│         ACCIONES DEL USUARIO Y REPUTACIÓN       │
└─────────────┬───────────────────────┬───────────┘
              │                       │
              ▼                       ▼
    REPORTE CONFIRMADO         SPAM/DESMENTIDOS
    +10 puntos por cada        -5 puntos cada
    confirmación validada      desmentido acumulado
              │                       │
              ▼                       ▼
    REPUTACION: puntos++        SPAM_STRIKES++
              │                       │
         [0-50] Novato               │
         [51-150] Colaborador        │
         [151-300] Experto           │
         [300+] Maestro              │
              │                       │
              └───────────┬──────────┘
                          │
                   strikes_spam > 3
                          │
                          ▼
                  USUARIO BLOQUEADO
                  estado: BLOQUEADO
```

---

## 5. Flujo de Zonas y Meteorología

```
┌──────────────────────────────────────┐
│    USUARIO SOLICITA ZONA PARTICULAR  │
│    GET /api/zones/:id/weather        │
└──────────────────────┬────────────────┘
                       │
                       ▼
         ┌──────────────────────────┐
         │  VERIFICAR CACHÉ LOCAL   │
         │ cache_meteo.última_actua.│
         │ ¿< 1 hora?               │
         └────────┬──────────┬──────┘
                  │          │
              SI  │          │ NO
                  │          │
        ┌─────────▼──┐      │
        │ Retornar    │      │
        │ CACHÉ       │      ▼
        │ (rápido)    │  OBTENER DE API
        └─────────────┘  (AEMET/Open-Meteo)
                              │
                              ▼
                    ┌──────────────────┐
                    │ GUARDAR EN CACHÉ │
                    │ Actualizar fecha │
                    └──────────┬───────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │  RETORNAR AL     │
                    │  FRONTEND        │
                    └──────────────────┘

DASHBOARD: GET /api/zones/:id/dashboard
    │
    ├─ Agregar reportes por tipo
    ├─ Calcular promedio confirmaciones
    ├─ Calcular promedio desmentidos
    ├─ Ordenar por cantidad de reportes
    │
    └─ Retornar estadísticas
```

---

## 6. Flujo de Comments/Foros

```
┌──────────────────────────────────┐
│  USUARIO QUIERE COMENTAR EN ZONA │
└──────────────────┬───────────────┘
                   │
                   ├─ GET /api/comments/:zoneId
                   │  └─ Retorna últimos 50 comentarios
                   │     ordenados por fecha descendente
                   │
                   └─ POST /api/comments
                      {usuario_id, zona_id, contenido, ...}
                      │
                      ├─ Validar contenido (1-5000 chars)
                      ├─ Validar usuario existe
                      ├─ Crear comentario
                      ├─ estado: ACTIVO (por defecto)
                      │
                      └─ Retornar comentario con datos usuario
```

---

## 7. Flujo de Panel Admin

```
┌──────────────────────────────────┐
│      ADMIN ACCEDE PANEL           │
└──────────────┬──────────────────┘
               │
       ┌───────┴──────────────────────┐
       │                              │
       ▼                              ▼
  MÉTRICAS                    GESTIÓN DE USUARIOS
  GET /admin/metrics          PATCH /admin/users/:id/block
  │                           │
  ├─ Últimas 24 horas        ├─ Bloquear usuario
  ├─ Errores & latencia      │  estado: BLOQUEADO
  ├─ Uso de tokens IA        │
  ├─ Nuevos reportes         ├─ Desbloquear usuario
  │                          │  estado: ACTIVO
  └─ Dashboard visuales      │
                             └─ Usuario bloqueado
                                no puede hacer nada

  CATEGORÍAS
  POST /admin/categories
  │
  ├─ Crear nuevo tipo de reporte
  │  (Avalancha, Hielo, Carretera cortada, etc.)
  │
  └─ Activar/desactivar según estación
```

---

## 8. Flujo del Chatbot/IA

```
┌─────────────────────────────┐
│  USUARIO HACE PREGUNTA IA   │
│  POST /api/chat/ask         │
└──────────────┬──────────────┘
               │
        {usuario_id, pregunta, contexto_geo}
               │
               ├─ Validar cuota de peticiones
               │  (limites_ia.peticiones_hoy)
               │
               ├─ Validar password (MIN 6 chars)
               │
               ├─ TODO: Integrar API IA
               │  - Enviar pregunta a OpenAI/Claude
               │  - Incluir contexto geográfico
               │  - Procesador respuesta
               │
               ├─ Registrar métrica del sistema
               │   (SystemMetric: tipo_USO_TOKEN)
               │
               ├─ Incrementar contador:
               │   limites_ia.peticiones_hoy++
               │
               └─ Retornar respuesta + contexto usado
                   {id, pregunta, respuesta, timestamp}
```

---

## 9. Estructura de Índices MongoDB

```
USERS:
├─ Índice unique en: datos_acceso.email

ZONES:
├─ Índice 2dsphere: geolocalizacion
   (para $near queries de proximidad)

REPORTS:
├─ Índice 2dsphere: geolocalizacion
├─ Índice TTL: createdAt (expireAfterSeconds: 172800)
   (auto-elimina después de 48 horas)

FAVORITE_ZONES:
├─ Índice unique: (usuario_id, zona_id)
   (evita duplicados)

Otros:
├─ Índice automático en _id (todas las colecciones)
```

---

## 10. Estado HTTP Esperados

```
✅ 200 OK
   - GET exitoso
   - PATCH completado
   - PUT completado

✅ 201 CREATED
   - POST exitoso
   - Recurso creado

⚠️ 400 BAD REQUEST
   - Validación falló
   - Email duplicado
   - Datos inválidos

⚠️ 401 UNAUTHORIZED
   - Credenciales incorrectas
   - Usuario bloqueado

⚠️ 403 FORBIDDEN
   - Acceso denegado
   - Usuario sin permisos (TODO: RBAC)

⚠️ 404 NOT FOUND
   - Recurso no existe
   - Usuario no encontrado
   - Reporte no existe

❌ 500 INTERNAL SERVER ERROR
   - Error no controlado
   - Problema de BD
```

---

## 11. Validaciones del Sistema

```
ENTRADA (Express Validator):
├─ isMongoId()      → Valida IDs de MongoDB
├─ isEmail()        → Valida formato email
├─ isString/trim()  → Limpia y valida strings
├─ isInt/isFloat()  → Valida números
├─ isArray()        → Valida arrays
└─ isInt({min,max}) → Valida rangos

NEGOCIO:
├─ Email único en la BD
├─ Usuario existe antes de operar
├─ Zona existe antes de crear reporte
├─ Categoría existe antes de crear reporte
├─ Coordenadas válidas [lon, lat]
├─ Usuario activo (no bloqueado)
├─ Cuota de IA no excedida
└─ Reporte no duplicado
```

---

## 12. Flujo de Integración Futura

```
┌─────────────────────────────────────────┐
│      APIs EXTERNAS (TODO)                │
├─────────────────────────────────────────┤
│                                          │
│  METEOROLOGÍA                            │
│  ├─ AEMET (Agencia Estatal Meteorología)│
│  └─ Open-Meteo (Alternativa)             │
│                                          │
│  IA & NLP                                │
│  ├─ OpenAI (GPT-4)                       │
│  ├─ Claude (Anthropic)                   │
│  └─ Hugging Face                         │
│                                          │
│  NOTIFICACIONES                          │
│  ├─ SendGrid (Email)                     │
│  ├─ Firebase Cloud Messaging (Push)      │
│  └─ Twilio (SMS)                         │
│                                          │
│  MAPAS                                   │
│  ├─ Mapbox                               │
│  └─ Google Maps                          │
│                                          │
└─────────────────────────────────────────┘
```

---

## 13. Seguridad Implementada vs TODO

```
✅ IMPLEMENTADO:
├─ CORS (habilitado)
├─ Helmet (headers de seguridad)
├─ input validation (express-validator)
├─ Roles de usuario (PUBLIC, USER, ADMIN)
├─ Estado de usuario (ACTIVO, BLOQUEADO)
└─ Error handling centralizado

❌ TODO:
├─ JWT tokens
├─ Password hashing (bcrypt)
├─ Autenticación middleware
├─ Rate limiting
├─ Autorización por rol
├─ HTTPS/TLS
├─ CSRF protection
└─ Sanitización de inputs (XSS protection)
```

---

## 14. Logs del Sistema

```
WINSTON LOGGER NIVELES:
├─ error   → Errores críticos
├─ warn    → Advertencias
├─ info    → Información general
└─ debug   → Detalles de depuración

ARCHIVOS DE LOG: logs/combined.log
ROTACIÓN: Diaria (máximo 14 días)

EJEMPLOS:
├─ "Usuario registrado: user@example.com"
├─ "GET /zones filtro estado=ACTIVA"
├─ "Usuario 123 zona favorita añadida"
├─ "SIGTERM received — shutting down gracefully"
└─ "Error: Validation Error"
```

---

**Diagrama actualizado:** 17 de marzo de 2026
**Versión:** 1.0.0
**Estado:** Listo para desarrollo
