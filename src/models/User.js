const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Datos de acceso
    datos_acceso: {
      email: { type: String, required: true, unique: true },
      password_hash: { type: String, required: true },
      rol: { type: String, enum: ["PUBLIC", "USER", "ADMIN"], default: "PUBLIC" },
    },
    // Perfil
    perfil: {
      nombre: String,
      avatar_url: String,
    },
    // Zonas favoritas con configuración embebida (subdocumentos)
    preferencias: [
      {
        zona_id: { type: mongoose.Schema.Types.ObjectId, required: true },
        // Configuración de alertas para esta zona
        configuracion_alertas: {
          aludes: {
            activo: { type: Boolean, default: false },
            umbral_nivel: { type: Number, min: 1, max: 5 },
          },
          viento: {
            activo: { type: Boolean, default: false },
            umbral_kmh: Number,
          },
          reportes_comunidad: {
            activo: { type: Boolean, default: false },
            tipos_suscritos: [String], // Arrays de tipos de reporte directos
          },
        },
        metodo_notificacion: {
          type: String,
          enum: ["PUSH", "EMAIL", "SMS", "NINGUNO"],
          default: "PUSH",
        },
        fecha_agregada: { type: Date, default: Date.now },
      },
    ],
    // Límites de API
    limites_ia: {
      peticiones_hoy: { type: Number, default: 0 },
      ultimo_reset: { type: Date, default: Date.now },
    },
    // Estado de la cuenta
    estado: { type: String, enum: ["ACTIVO", "BLOQUEADO"], default: "ACTIVO" },
    // Reputación
    reputacion: {
      puntos: { type: Number, default: 0 },
      medalla: { type: String, default: "Novato" },
      strikes_spam: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_USERS || "users",
  }
);

module.exports = mongoose.model("User", userSchema);
