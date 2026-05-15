/**
 * @file Modelo de Usuario
 * @module models/User
 * @description Modelo que gestiona la información de usuarios del sistema. Almacena datos de autenticación
 * (credenciales locales y OAuth), perfil, zonas favoritas y límites de API. Se relaciona con Zone a través
 * de preferencias y con Report y Comment como autor de estos documentos.
 */

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    // Datos de acceso
    datos_acceso: {
      email: { type: String, required: true, unique: true, lowercase: true },
      password_hash: { type: String, required: false }, // Opcional para OAuth
      google_id: { type: String, unique: true, sparse: true }, // Para OAuth con Google
      github_id: { type: String, unique: true, sparse: true }, // Para OAuth con GitHub
      provider: { type: String, enum: ["local", "google", "github"], default: "local" },
      rol: { type: String, enum: ["USER", "ADMIN"], default: "USER" },
    },
    // Perfil
    perfil: {
      nombre: String,
      avatar_seed: String, // Seed para generar avatar con DiceBear
      avatar_style: { type: String, default: 'avataaars' },
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
    estado: { type: String, enum: ["ACTIVO", "ELIMINADO"], default: "ACTIVO" },
    fechaEliminacion: { type: Date, default: null }, // Timestamp cuando se elimina la cuenta
    
    // Recuperación de contraseña
    passwordResetToken: { type: String, default: null },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_USERS || "users",
  }
);

// Virtual para generar avatar con DiceBear
/**
 * Virtual que genera la URL del avatar del usuario usando la API de DiceBear.
 * Utiliza el avatar_seed o el nombre del usuario como entrada para la generación consistente.
 * @returns {string} URL del avatar SVG generado por DiceBear
 */
userSchema.virtual('perfil.avatar_url').get(function() {
  const seed = this.perfil.avatar_seed || this.perfil.nombre || this._id.toString();
  const style = this.perfil.avatar_style || 'avataaars';
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
});

// Incluir virtuales en JSON
/**
 * Configura el esquema para incluir virtuales al serializar a JSON y a Objeto.
 * Esto permite que la URL del avatar esté disponible en las respuestas de API.
 */
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("User", userSchema);
