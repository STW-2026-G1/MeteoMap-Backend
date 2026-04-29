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
userSchema.virtual('perfil.avatar_url').get(function() {
  const seed = this.perfil.avatar_seed || this.perfil.nombre || this._id.toString();
  const style = this.perfil.avatar_style || 'avataaars';
  return `https://api.dicebear.com/9.x/${style}/svg?seed=${encodeURIComponent(seed)}`;
});

// Incluir virtuales en JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model("User", userSchema);
