# 🔄 Refactorización a MongoDB Native Patterns

## Resumen de cambios

Se ha refactorizado la aplicación para seguir patrones nativos de MongoDB en lugar de patrones SQL relacionales. Los cambios principales son:

---

## 🗂️ Cambios en Modelos (src/models/)

### 1. **User.js** - Preferencias ahora contienen configuración embebida

**Antes:**
```javascript
preferencias: [{ type: mongoose.Schema.Types.ObjectId, ref: "Zone" }]
```

**Ahora:**
```javascript
preferencias: [
  {
    zona_id: { type: mongoose.Schema.Types.ObjectId, required: true },
    configuracion_alertas: { ... },
    metodo_notificacion: { type: String, ... },
    fecha_agregada: { type: Date, default: Date.now }
  }
]
```

**Ventaja:** Todo el contexto de un usuario favorito está DENTRO del documento. No necesitas hacer queries cruzadas a otra colección.

---

### 2. **Report.js** - Información de categoría embebida

**Antes:**
```javascript
categoria_id: { type: mongoose.Schema.Types.ObjectId, ref: "ReportCategory" }
```

**Ahora:**
```javascript
categoria: {
  nombre: { type: String, required: true },
  icono_marcador: { type: String, required: true }
}
```

**Ventaja:** El nombre y icono están DENTRO del reporte. No necesitas `populate()` ni queries a ReportCategory.

---

### 3. **Report.js** - Comentarios embebidos (newDenoising)

**Nuevo campo:**
```javascript
comentarios: [
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId },
    autor_nombre: String,        // Desnormalizado para no hacer populate
    contenido: { type: String },
    etiqueta: String,
    estado: { type: String },
    fecha: { type: Date }
  }
]
```

**Ventaja:** Si algunos reportes tienen solo 5-10 comentarios, es MUCHO más rápido tenerlos aquí que en otra colección.

---

### 4. **FavoriteZone.js** - ⚠️ Eliminada (conceptualmente)

Esta colección **ya NO se usa**. La configuración está ahora embebida en `User.preferencias`.

---

### 5. **ReportCategory.js** - ⚠️ Eliminada (conceptualmente)

Esta colección **ya NO se usa**. Los datos están ahora directamente en `Report.categoria`.

---

## 🛣️ Cambios en Rutas (src/routes/)

### 1. **users.js** - PUT /api/user/favorites

**Antes:**
```json
{
  "userId": "...",
  "zonaId": "...",
  "accion": "add"
}
```

**Ahora:**
```json
{
  "userId": "...",
  "zonaId": "...",
  "accion": "add",
  "configuracion": {
    "metodo_notificacion": "PUSH",
    "configuracion_alertas": {
      "aludes": { "activo": true, "umbral_nivel": 3 },
      "viento": { "activo": true, "umbral_kmh": 50 },
      "reportes_comunidad": { "activo": true, "tipos_suscritos": ["Avalancha"] }
    }
  }
}
```

**Cambio en lógica:**
- Ahora se crea un objeto completo con configuración y se pushea a `user.preferencias`
- Eliminado: `.populate("preferencias")` en el GET de perfil (no lo necesitas)

---

### 2. **reports.js** - POST /api/reports

**Antes:**
```json
{
  "usuario_id": "...",
  "zona_id": "...",
  "categoria_id": "...",
  "tipo": "Avalancha",
  "descripcion": "...",
  "coordinates": [...]
}
```

**Ahora:**
```json
{
  "usuario_id": "...",
  "zona_id": "...",
  "nombre_categoria": "Avalancha",
  "icono_marcador": "⚠️",
  "tipo": "Avalancha",
  "descripcion": "...",
  "coordinates": [...]
}
```

**Cambio en lógica:**
- El slug `categoria_id` se reemplaza con `nombre_categoria` e `icono_marcador`
- El objeto report incluye: `categoria: { nombre, icono_marcador }`
- Eliminado: `.populate("categoria_id")` de GET (no lo necesitas)

---

### 3. **comments.js** - POST /api/comments (Híbrida)

**Ahora es INTELIGENTE:**
- Si envías `reporte_id`: El comentario se agrega al array `report.comentarios` (embebido)
- Si NO envías `reporte_id`: El comentario va a la colección `comments` separada (para comentarios de zona)

```javascript
if (reporte_id) {
  // Comentario embebido en report
  report.comentarios.push(nuevoComentario);
  await report.save();
} else {
  // Comentario de zona separado
  const newComment = new Comment({ ... });
  await newComment.save();
}
```

**Ventaja:** Flexibilidad. Pequeños reportes tienen comentarios embebidos (fast). Zonas siguen teniendo colección separada de comentarios (scalable).

---

## 🧪 Cambios en Tests (test/requests.rest)

### 1. Create Report
```rest
POST /api/reports
{
  "usuario_id": "...",
  "zona_id": "...",
  "nombre_categoria": "Avalancha",      ← Cambio
  "icono_marcador": "⚠️",               ← Nuevo
  "tipo": "Avalancha",
  "descripcion": "...",
  "coordinates": [...]
}
```

### 2. Add Favorite Zone
```rest
PUT /api/user/favorites
{
  "userId": "...",
  "zonaId": "...",
  "accion": "add",
  "configuracion": {                    ← Nuevo
    "metodo_notificacion": "PUSH",
    "configuracion_alertas": { ... }
  }
}
```

---

## 📊 Comparativa: Antes vs Después

| Operación | Antes | Después |
|-----------|-------|---------|
| **Leer reporte + categoría** | 2 queries + populate | 1 query (todo incluído) |
| **Leer usuario + zonas favoritas + config** | 2 queries + populate | 1 query (todo embebido) |
| **Leer comentarios de reporte** | 2 queries (Report + Comments) | 1 query (en Report) |
| **Tamaño documento** | Pequeño | Ligeramente más grande (pero razonable) |

---

## ⚠️ IMPORTANTE: Migración de datos

Los modelos han cambiado. Si tienes datos viejos en MongoDB, necesitarás:

### Option A: Limpiar la BD
```bash
# Eliminar todas las colecciones viejas
db.users.deleteMany({})
db.report_categories.deleteMany({})
db.favorite_zones.deleteMany({})
db.reports.deleteMany({})
db.comments.deleteMany({})
```

### Option B: Script de migración (si tienes datos importantes)
```javascript
// Pseudo-código para migrar
// 1. Leer todos los favorite_zones
// 2. Para cada uno, pushear a user.preferencias
// 3. Leer todos los reports y reemplazar categoria_id con categoria {}
// 4. Leer comentarios de report y pushearlos a report.comentarios
```

---

## ✅ Checklist de cambios

- [x] **User.js** - preferencias con objetos embebidos
- [x] **Report.js** - categoria embebida + comentarios embebidos
- [x] **FavoriteZone.js** - eliminada (no usada)
- [x] **ReportCategory.js** - eliminada (no usada)
- [x] **users.js routes** - actualizado PUT /favorites
- [x] **reports.js routes** - actualizado POST /reports
- [x] **comments.js routes** - lógica híbrida para reportes + zonas
- [x] **test/requests.rest** - actualizado con nuevos payloads

---

## 🚀 Próximos pasos

1. **Limpiar datos viejos** o hacer migración
2. **Probar todas las rutas** con los nuevos payloads
3. **Actualizar frontend** (si existe) para enviar los nuevos campos
4. **Indexar correctamente**:
   ```javascript
   // En /config/database.js o al conectar
   db.reports.createIndex({ "categoria.nombre": 1 })
   db.users.createIndex({ "preferencias.zona_id": 1 })
   ```

