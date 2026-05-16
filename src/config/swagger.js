/**
 * @file Configuración de Swagger
 * @module config/swagger
 * @description Configuración principal para la generación y especificación OpenAPI de Swagger.
 * @author MeteoMap Team
 */

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
- **Foros de usuarios** - Comentarios y debates por zona
- **Asistente de IA** - Chat para obtener orientación inteligente sobre seguridad en la montaña
- **Panel de administración** - Métricas del sistema, gestión de usuarios y gestión de categorías
- **Informes TTL** - Eliminación automática de informes después de 48 horas

## URL base
${process.env.SWAGGER_URL || "http://localhost:3000"}

## Autenticación
La mayoría de los puntos finales requieren un ID de usuario en el cuerpo de la solicitud. Los tokens JWT están pendientes.
## Colecciones
- Usuarios (con roles: PÚBLICO, USUARIO, ADMINISTRADOR)
- Zonas (áreas geográficas con GeoJSON)
- Informes (informes de la comunidad con validación)
- Comentarios (discusiones del foro)
- Categorías de informes (tipos de informes)
- Métricas del sistema (seguimiento del rendimiento)
- Zonas favoritas (preferencias de usuario)
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
        url: process.env.SWAGGER_URL || "http://localhost:{port}",
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
                provider: { type: "string", enum: ["local", "google", "github"], default: "local" },
                rol: { type: "string", enum: ["USER", "ADMIN"], default: "USER" },
              },
            },
            perfil: {
              type: "object",
              properties: {
                nombre: { type: "string", example: "Juan Pérez" },
                avatar_seed: { type: "string" },
                avatar_style: { type: "string", example: "avataaars" },
                biografia: { type: "string" },
                ubicacion: { type: "string" },
                avatar_url: { type: "string", description: "Generado virtualmente con DiceBear" },
              },
            },
            preferencias: {
              type: "array",
              items: { type: "string" },
              description: "Array of Zone ObjectIds",
            },
            limites_ia: {
              type: "object",
              properties: {
                peticiones_hoy: { type: "number", default: 0 },
                ultimo_reset: { type: "string", format: "date-time" },
              },
            },
            estado: { type: "string", enum: ["ACTIVO", "ELIMINADO"], default: "ACTIVO" },
            fechaEliminacion: { type: "string", format: "date-time", nullable: true },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
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
                current: {
                  type: "object",
                  properties: {
                    datos_crudos: { type: "object" },
                    ultima_actualizacion: { type: "string", format: "date-time" },
                  },
                },
                forecast: {
                  type: "object",
                  properties: {
                    datos_crudos: { type: "object" },
                    ultima_actualizacion: { type: "string", format: "date-time" },
                  },
                },
              },
            },
            estado: { type: "string", enum: ["ACTIVA", "INACTIVA"], default: "ACTIVA" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
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
            contenido: {
              type: "object",
              properties: {
                descripcion: { type: "string", example: "Avalancha vista en cara norte" },
              },
            },
            validaciones: {
              type: "object",
              properties: {
                usuarios_confirmaron: {
                  type: "array",
                  items: { type: "string" },
                  description: "Lista de User ObjectIds",
                },
                usuarios_desmintieron: {
                  type: "array",
                  items: { type: "string" },
                  description: "Lista de User ObjectIds",
                },
              },
            },
            estado: {
              type: "string",
              enum: ["SOSPECHOSO", "LEGITIMO"],
              default: "SOSPECHOSO",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
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
            parent_id: { type: "string", nullable: true, description: "Comment ObjectId para respuestas anidadas" },
            likes: {
              type: "array",
              items: { type: "string" },
              description: "Array de User ObjectIds que han dado like",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        
        // ─── Alerts Schema ───
        AemetAlert: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            aemet_id: { type: "string", description: "Identificador único de la alerta de AEMET" },
            zona: { type: "string", example: "Picos de Europa", description: "Nombre de la zona afectada" },
            tipo: { type: "string", example: "Nevadas", description: "Fenómeno meteorológico" },
            nivel: { type: "string", example: "Naranja" },
            nivelNumerico: { type: "number", example: 2 },
            descripcion: { type: "string" },
            instrucciones: { type: "string" },
            probabilidad: { type: "string" },
            certidumbre: { type: "string" },
            urgencia: { type: "string" },
            enlace: { type: "string" },
            coordenadas: {
              type: "object",
              properties: {
                latitud: { type: "number", example: 43.15 },
                longitud: { type: "number", example: -4.82 }
              },
            },
            poligono_raw: { type: "string", nullable: true },
            poligono_geojson: {
              type: "object",
              properties: {
                type: { type: "string" },
                coordinates: {
                  type: "array",
                  items: { type: "array" }
                }
              }
            },
            color: { type: "string", example: "#ff9900", description: "Código hexadecimal del color de la alerta" },
            emision: { type: "string", format: "date-time" },
            validez_inicio: { type: "string", format: "date-time" },
            validez_fin: { type: "string", format: "date-time" },
            fecha_procesamiento: { type: "string", format: "date-time" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          }
        },

        // ─── Category Schema ───
        ReportCategory: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            nombre: { type: "string", example: "Avalancha" },
            descripcion: { type: "string", example: "Avalanchas activas o potenciales" },
            icono_marcador: { type: "string", example: "snowflake" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
          },
        },
        
        // ─── System Metric Schema ───
        SystemMetric: {
          type: "object",
          properties: {
            _id: { type: "string", description: "MongoDB ObjectId" },
            origen: { type: "string", enum: ["CHATBOT", "API_METEO", "AUTH", "SISTEMA"] },
            tipo: { type: "string", enum: ["ERROR", "LATENCIA", "USO_TOKEN", "NUEVO_REPORTE"] },
            valor: { type: "number" },
            detalles: { type: "object", description: "Log details (Mixed object)" },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
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
      { name: "Auth", description: "Authentication endpoints" },
      { name: "User", description: "User management endpoints" },
      { name: "Zones", description: "Zone management and weather" },
      { name: "Reports", description: "Community reports" },
      { name: "Comments", description: "Forum comments" },
      { name: "Chat", description: "AI chat assistant" },
      { name: "Admin", description: "Administration panel" },
      { name: "AEMET Alerts", description: "Alertas de la AEMET" }
    ],
  },

  apis: ["./src/routes/*.js"],
};

module.exports = swaggerJsdoc(options);