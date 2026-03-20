const swaggerJsdoc = require("swagger-jsdoc");

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Mountain Safety Platform API",
      version: "1.0.0",
      description: `
A comprehensive REST API for mountain safety management and community reporting.

## Features
- **User Authentication & Authorization** - Registration, login with role-based access
- **Zone Management** - Geographic zones with GeoJSON support for proximity queries
- **Weather Caching** - Store and manage meteorological data for mountain zones
- **Community Reports** - Submit and validate reports with geolocation
- **Reputation System** - Community validation with points and reputation tracking
- **User Forums** - Comments and discussions per zone
- **AI Assistant** - Chat endpoint for intelligent mountain safety guidance
- **Admin Panel** - System metrics, user management, category management
- **TTL Reports** - Automatic deletion of reports after 48 hours

## Base URL
\`http://localhost:3000/api\`

## Authentication
Most endpoints require a \`userId\` in the request body. JWT tokens are TODO.

## Collections
- Users (with roles: PUBLIC, USER, ADMIN)
- Zones (geographic areas with GeoJSON)
- Reports (community reports with validation)
- Comments (forum discussions)
- Report Categories (types of reports)
- System Metrics (performance tracking)
- Favorite Zones (user preferences with alerts)
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
        url: "http://localhost:{port}/api",
        description: "Local development server",
        variables: {
          port: { default: process.env.PORT || "3000" },
        },
      },
    ],
    components: {
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
            error: { type: "string", example: "Validation Error" },
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