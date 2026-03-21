const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Mountain Safety Platform API",
      version: "1.0.0",
      description: `
Una API REST integral para la gestión de la seguridad en montaña y la elaboración de informes para la comunidad.
## Características
- **Autenticación y autorización de usuarios** - Registro e inicio de sesión con acceso basado en roles
- **Gestión de zonas** - Zonas geográficas con soporte GeoJSON para consultas de proximidad
- **Almacenamiento en caché de datos meteorológicos** - Almacena y gestiona datos meteorológicos para zonas de montaña
- **Informes de la comunidad** - Envía y valida informes con geolocalización
- **Sistema de reputación** - Validación de la comunidad con puntos y seguimiento de la reputación
- **Foros de usuarios** - Comentarios y debates por zona
- **Asistente de IA** - Chat para obtener orientación inteligente sobre seguridad en la montaña
- **Panel de administración** - Métricas del sistema, gestión de usuarios y gestión de categorías
- **Informes TTL** - Eliminación automática de informes después de 48 horas

## URL base
${process.env.SWAGGER_URL} || "http://localhost:3000"

## Autenticación
La mayoría de los puntos finales requieren un ID de usuario en el cuerpo de la solicitud. Los tokens JWT están pendientes.
## Colecciones
- Usuarios (con roles: PÚBLICO, USUARIO, ADMINISTRADOR)
- Zonas (áreas geográficas con GeoJSON)
- Informes (informes de la comunidad con validación)
- Comentarios (discusiones del foro)
- Categorías de informes (tipos de informes)
- Métricas del sistema (seguimiento del rendimiento)
- Zonas favoritas (preferencias de usuario con alertas)
      `.trim(),
      contact: {
        name: "Mountain Safety Platform Team",
        url: "https://example.com",
      },
      license: {
        name: "ISC",
      },
    },
    servers: [
      {
        url: `${process.env.SWAGGER_URL}` || "http://localhost:{port}",
        description: "Local development server",
        variables: {
          port: { default: process.env.PORT || "3000" },
        },
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Paste only the JWT access token",
        },
      },
      schemas: {
        // ─── User Schemas ───
        User: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            datos_acceso: {
              type: "object",
              properties: {
                email: { type: "string", example: "user@example.com" },
                rol: { type: "string", enum: ["PUBLIC", "USER", "ADMIN"], default: "PUBLIC" },
              },
            },
            perfil: {
              type: "object",
              properties: {
                nombre: { type: "string", example: "Juan Pérez" },
                avatar_url: { type: "string" },
              },
            },
            reputacion: {
              type: "object",
              properties: {
                puntos: { type: "integer", example: 150 },
                medalla: { type: "string", example: "Colaborador" },
                strikes_spam: { type: "integer", example: 0 },
              },
            },
            estado: { type: "string", enum: ["ACTIVO", "BLOQUEADO"], default: "ACTIVO" },
            preferencias: {
              type: "array",
              items: { type: "string" },
              description: "Array of Zone ObjectIds",
            },
          },
        },

        // ─── Zone Schemas ───
        Zone: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            nombre: { type: "string", example: "Picos de Europa" },
            descripcion: { type: "string", example: "Cordillera montañosa en el norte de España" },
            geolocalizacion: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Point"], default: "Point" },
                coordinates: {
                  type: "array",
                  items: { type: "number" },
                  example: [-5.0, 43.25],
                  description: "[Longitude, Latitude]",
                },
              },
            },
            cache_meteo: {
              type: "object",
              properties: {
                datos_crudos: { type: "object" },
                ultima_actualizacion: { type: "string", format: "date-time" },
              },
            },
            estado: { type: "string", enum: ["ACTIVA", "INACTIVA"], default: "ACTIVA" },
          },
        },

        // ─── Report Schemas ───
        Report: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            usuario_id: { type: "string", description: "User ObjectId" },
            zona_id: { type: "string", description: "Zone ObjectId" },
            categoria_id: { type: "string", description: "Category ObjectId" },
            tipo: { type: "string", example: "Avalancha" },
            contenido: {
              type: "object",
              properties: {
                descripcion: { type: "string", example: "Avalancha vista en cara norte" },
                foto_url: { type: "string" },
              },
            },
            geolocalizacion: {
              type: "object",
              properties: {
                type: { type: "string", enum: ["Point"], default: "Point" },
                coordinates: {
                  type: "array",
                  items: { type: "number" },
                  example: [-5.0, 43.25],
                },
              },
            },
            validaciones: {
              type: "object",
              properties: {
                confirmaciones: { type: "integer", example: 5 },
                desmentidos: { type: "integer", example: 1 },
              },
            },
            valoracion_global: { type: "integer", example: 4 },
            estado: {
              type: "string",
              enum: ["PENDIENTE", "ACTIVO", "OCULTO", "SPAM"],
              default: "PENDIENTE",
            },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Comment Schema ───
        Comment: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            usuario_id: { type: "string", description: "User ObjectId" },
            zona_id: { type: "string", description: "Zone ObjectId" },
            reporte_id: { type: "string", nullable: true, description: "Report ObjectId (optional)" },
            contenido: { type: "string", example: "Excelente información sobre la zona" },
            etiqueta: { type: "string", example: "Observación" },
            estado: { type: "string", enum: ["ACTIVO", "SPAM", "ELIMINADO"], default: "ACTIVO" },
            createdAt: { type: "string", format: "date-time" },
          },
        },

        // ─── Category Schema ───
        ReportCategory: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            nombre: { type: "string", example: "Avalancha" },
            descripcion: { type: "string", example: "Avalanchas activas o potenciales" },
            icono_marcador: { type: "string", example: "icon_avalanche" },
            estado: { type: "string", enum: ["ACTIVA", "INACTIVA"], default: "ACTIVA" },
            creado_por: { type: "string", description: "Admin user ObjectId" },
          },
        },

        // ─── Error Schemas ───
        Error: {
          type: "object",
          properties: {
            error: { type: "string", example: "Not Found" },
            message: { type: "string", example: "Usuario no encontrado" },
          },
        },

        ValidationError: {
          type: "object",
          properties: {
            error: { type: "string", example: "Error de validación" },
            errors: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  field: { type: "string", example: "email" },
                  message: { type: "string", example: "Email is required" },
                },
              },
            },
          },
        },

        SuccessResponse: {
          type: "object",
          properties: {
            message: { type: "string" },
            data: { type: "object" },
          },
        },
      },

      parameters: {
        userId: {
          name: "userId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "MongoDB ObjectId of the user",
        },
        zoneId: {
          name: "zoneId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "MongoDB ObjectId of the zone",
        },
        reportId: {
          name: "reportId",
          in: "path",
          required: true,
          schema: { type: "string" },
          description: "MongoDB ObjectId of the report",
        },
      },
    },

    tags: [
      { name: "System", description: "Health and status endpoints" },
      { name: "Auth", description: "Authentication endpoints" },
      { name: "User", description: "User management endpoints" },
      { name: "Zones", description: "Zone management and weather" },
      { name: "Reports", description: "Community reports" },
      { name: "Comments", description: "Forum comments" },
      { name: "Chat", description: "AI chat assistant" },
      { name: "Admin", description: "Administration panel" },
    ],
  },

  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJsdoc(options);