# 🏗️ Refactorización Arquitectónica: MVC Pattern

## Estructura del Proyecto (Antes vs Después)

### ❌ ANTES (Monolítico en Routes)
```
src/
├── routes/
│   ├── users.js      (incluía toda la lógica)
│   ├── reports.js    (incluía toda la lógica)
│   └── comments.js   (incluía toda la lógica)
└── models/
    ├── User.js
    ├── Report.js
    └── Comment.js
```

**Problema:** Las rutas contenían:
- Queries a base de datos
- Lógica de negocio
- Validaciones
- Transformación de datos
→ **Difícil de probar, mantener y reutilizar**

---

### ✅ DESPUÉS (MVC Separado)
```
src/
├── models/           # Esquemas Mongoose
│   ├── User.js
│   ├── Report.js
│   ├── Comment.js
│   ├── Zone.js
│   └── ...
├── services/         # Lógica de negocio (NEW)
│   ├── userService.js
│   ├── reportService.js
│   ├── commentService.js
│   ├── zoneService.js
│   └── ...
├── controllers/      # Handlers de HTTP (NEW)
│   ├── userController.js
│   ├── reportController.js
│   ├── commentController.js
│   ├── zoneController.js
│   └── ...
├── routes/           # Definición de endpoints
│   ├── users.js
│   ├── reports.js
│   ├── comments.js
│   ├── zones.js
│   └── ...
├── middleware/
│   ├── errorHandler.js
│   └── httpLogger.js
├── config/
│   ├── database.js
│   ├── logger.js
│   └── swagger.js
└── utils/
    └── query.js
```

---

## 🎯 Responsabilidades de cada capa

### 1. **Models** (src/models/)
- Esquemas Mongoose
- Validaciones de base de datos
- Índices y métodos de modelo

**Ejemplo:**
```javascript
// User.js
const userSchema = new mongoose.Schema({
  datos_acceso: { ... },
  preferencias: [ { ... } ],
  ...
});
```

---

### 2. **Services** (src/services/) ⭐ NUEVA CAPA
- **Lógica de negocio pura**
- Orquestación de datos
- Validaciones de negocio
- Transformación de datos
- SIN conocimiento de HTTP

**Ejemplo:**
```javascript
// userService.js
class UserService {
  async getProfile(userId) {
    const user = await User.findById(userId);
    if (!user) throw new Error("Usuario no encontrado");
    
    return {
      id: user._id,
      email: user.datos_acceso.email,
      perfil: user.perfil,
      reputacion: user.reputacion,
      preferencias: user.preferencias,
    };
  }

  async updateFavorites(userId, zonaId, accion, configuracion) {
    // Lógica compleja de manejo de favoritos
    // Sin saber nada de HTTP requests/responses
  }
}
```

**Ventajas:**
- ✅ Testeable (sin mocks HTTP)
- ✅ Reutilizable (puede llamarse desde API, CLI, Jobs, etc.)
- ✅ Fácil de mantener (lógica centralizada)

---

### 3. **Controllers** (src/controllers/) ⭐ NUEVA CAPA
- **Handlers HTTP**
- Mapeo de req.body → Service → res.json()
- Manejo de errores HTTP
- Transformación de respuestas HTTP

**Ejemplo:**
```javascript
// userController.js
class UserController {
  async getProfile(req, res, next) {
    try {
      const { userId } = req.params;
      const profile = await userService.getProfile(userId);
      res.json(profile);
    } catch (err) {
      next(err);  // Middleware de error
    }
  }

  async updateFavorites(req, res, next) {
    try {
      const { userId, zonaId, accion, configuracion } = req.body;
      const result = await userService.updateFavorites(
        userId, 
        zonaId, 
        accion, 
        configuracion
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}
```

**Ventajas:**
- ✅ Thin Controllers (solo manejo HTTP)
- ✅ Lógica separada del transporte
- ✅ Fácil de testear (inyectar service mock)

---

### 4. **Routes** (src/routes/)
- **Definición de endpoints**
- Validación de input (express-validator)
- Mapeo a Controllers

**Ejemplo - ANTES (toda la lógica dentro):**
```javascript
router.get("/profile/:userId", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);  // DB aquí
    if (!user) return res.status(404).json({ error: "No encontrado" });
    
    // Transformación de datos aquí
    res.json({ id: user._id, email: user.datos_acceso.email, ... });
  } catch (err) {
    next(err);
  }
});
```

**DESPUÉS (limpio, delegado):**
```javascript
router.get(
  "/profile/:userId",
  [param("userId").isMongoId()],
  validate,
  (req, res, next) => userController.getProfile(req, res, next)
);
```

---

## 📊 Flujo de una request

```
Request
   ↓
Route (validación → controller)
   ↓
Controller (extrae {req.body, req.params} → service)
   ↓
Service (lógica de negocio + queries DB)
   ↓
Model (Mongoose queries)
   ↓
Database
   ↓
Service (retorna resultado)
   ↓
Controller (formatea respuesta HTTP)
   ↓
Response
```

---

## 🧪 Tests Ahora Están Organizados

**ANTES:**
```
test/
└── requests.rest      (todo junto)
```

**AHORA:**
```
test/
├── auth.rest          # Autenticación
├── users.rest         # Gestión de usuarios
├── reports.rest       # Crear/validar reportes
├── comments.rest      # Comentarios
├── zones.rest         # Datos geográficos
└── admin.rest         # Métricas y admin
```

### Usar desde VS Code REST Client:

1. **Extension:** [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client)
2. **Abrir:** `test/users.rest`
3. **Click:** "Send Request" sobre cualquier request

---

## 💡 Testing (Unit Test Examples)

### Test de Service (SIN HTTP)
```javascript
// __tests__/userService.test.js
describe("UserService", () => {
  it("getProfile retorna usuario con datos validos", async () => {
    const userId = new mongoose.Types.ObjectId();
    
    // Crear usuario en DB
    const user = await User.create({
      datos_acceso: { email: "test@test.com", password_hash: "..." },
      perfil: { nombre: "Test User" }
    });
    
    // Test service
    const result = await userService.getProfile(user._id);
    
    expect(result).toHaveProperty("id");
    expect(result).toHaveProperty("email");
    expect(result.email).toBe("test@test.com");
  });
});
```

### Test de Controller (Mock Service)
```javascript
// __tests__/userController.test.js
describe("UserController", () => {
  it("getProfile llama al service y retorna 200", async () => {
    // Mock service
    const mockService = {
      getProfile: jest.fn().mockResolvedValue({
        id: "123",
        email: "test@test.com"
      })
    };

    const req = { params: { userId: "123" } };
    const res = { json: jest.fn() };

    await userController.getProfile(req, res);

    expect(mockService.getProfile).toHaveBeenCalledWith("123");
    expect(res.json).toHaveBeenCalled();
  });
});
```

---

## 🚀 Beneficios de la nueva arquitectura

| Aspecto | Antes | Después |
|--------|-------|---------|
| **Testabilidad** | Difícil (HTTP acoplado) | Fácil (puro JS) |
| **Reutilización** | No (lógica en routes) | Sí (services) |
| **Mantenibilidad** | Monolítico | Separado en capas |
| **Debugging** | Difícil (lógica dispersa) | Fácil (capas claras) |
| **Reusabilidad Services** | No | Sí (CLI, Jobs, WebSockets, etc.) |
| **Escalabilidad** | Limitada | Horizontal (services) |

---

## 📋 Checklist de la refactorización

- [x] Crear carpetas `controllers/` y `services/`
- [x] Implementar UserService
- [x] Implementar ReportService
- [x] Implementar CommentService
- [x] Implementar ZoneService
- [x] Implementar UserController
- [x] Implementar ReportController
- [x] Implementar CommentController
- [x] Implementar ZoneController
- [x] Refactorizar routes/users.js
- [x] Refactorizar routes/reports.js
- [x] Refactorizar routes/comments.js
- [x] Refactorizar routes/zones.js
- [x] Dividir test/requests.rest en múltiples archivos
- [ ] Agregar Unit Tests (Jest/Mocha)
- [ ] Agregar Integration Tests
- [ ] Validar todas las rutas funcionan

---

## 🎓 Ejemplo Completo: Crear un Reporte

### Service (Lógica Pura)
```javascript
// services/reportService.js
async createReport(reportData) {
  // Validar usuario existe
  const user = await User.findById(reportData.usuario_id);
  if (!user) throw new Error("Usuario no encontrado");

  // Validar zona existe
  const zone = await Zone.findById(reportData.zona_id);
  if (!zone) throw new Error("Zona no encontrada");

  // Crear reporte
  const report = new Report({
    usuario_id: reportData.usuario_id,
    zona_id: reportData.zona_id,
    categoria: {
      nombre: reportData.nombre_categoria,
      icono_marcador: reportData.icono_marcador,
    },
    // ... más campos
  });

  return await report.save();
}
```

### Controller (Manejo HTTP)
```javascript
// controllers/reportController.js
async createReport(req, res, next) {
  try {
    const report = await reportService.createReport(req.body);
    res.status(201).json({
      message: "Reporte creado",
      report
    });
  } catch (err) {
    next(err);  // → errorHandler middleware
  }
}
```

### Route (Validación + Delegación)
```javascript
// routes/reports.js
router.post(
  "/",
  [
    body("usuario_id").isMongoId(),
    body("zona_id").isMongoId(),
    body("nombre_categoria").isString(),
    // ... más validaciones
  ],
  validate,
  (req, res, next) => reportController.createReport(req, res, next)
);
```

### Test REST
```rest
POST /api/reports
Content-Type: application/json

{
  "usuario_id": "652a1b2c3d4e5f6g7h8i9j0k",
  "zona_id": "652a1b2c3d4e5f6g7h8i9j0k",
  "nombre_categoria": "Avalancha",
  "icono_marcador": "⚠️",
  "tipo": "Avalancha",
  "descripcion": "Avalancha view en la cara norte",
  "coordinates": [-5.0, 43.25]
}
```

---

## 🔄 Próximos Pasos

1. **Agregar Unit Tests** (Jest)
   ```bash
   npm install --save-dev jest
   npm test
   ```

2. **Agregar Integration Tests**
   - Testear endpoints completos
   - Usar test database

3. **Documentación OpenAPI**
   - Swagger.js ya está configurado
   - Agregar más anotaciones @swagger

4. **Logging Estructurado**
   - Winston para logs mejores
   - Logs por capas

5. **Validación Centralizada**
   - Crear validadores reutilizables
   - DTOs (Data Transfer Objects)

---

## 📚 Referencias

- [MVC Pattern in Node.js](https://www.geeksforgeeks.org/mvc-pattern-in-node-js/)
- [Clean Code Architecture](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html)
- [Express Best Practices](https://expressjs.com/en/advanced/best-practice-performance.html)
- [Service Layer Pattern](https://martinfowler.com/eaaCatalog/serviceLayer.html)
