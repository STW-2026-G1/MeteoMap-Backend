const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Datos de acceso
    datos_acceso: {
      email: { type: String, required: true, unique: true, lowercase: true },
      password_hash: { type: String, required: false }, // Opcional para OAuth
      google_id: { type: String, unique: true, sparse: true }, // Para OAuth con Google
      provider: { type: String, enum: ["local", "google"], default: "local" },
      rol: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    },
    // Perfil
    perfil: {
      nombre: String,
      email: String,
      avatar_url: String,
      biografia: String,
      ubicacion: String,
    },
    // Zonas favoritas
    preferencias: [{ type: mongoose.Schema.Types.ObjectId, ref: "Zone" }],
    // Límites de API
    limites_ia: {
      peticiones_hoy: { type: Number, default: 0 },
      ultimo_reset: { type: Date, default: Date.now },
    },
    // Estado de la cuenta
    estado: { type: String, enum: ["ACTIVO", "BLOQUEADO", "ELIMINADO"], default: "ACTIVO" },

  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_USERS || "users",
  }
);

module.exports = mongoose.model("User", userSchema);
