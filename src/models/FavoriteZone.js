const mongoose = require("mongoose");

const favoriteZoneSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    zona_id: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    // Configuración de alertas
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
        tipos_suscritos: [{ type: mongoose.Schema.Types.ObjectId, ref: "ReportCategory" }],
      },
    },
    metodo_notificacion: {
      type: String,
      enum: ["PUSH", "EMAIL", "SMS", "NINGUNO"],
      default: "PUSH",
    },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_FAVORITES || "favorite_zones",
  }
);

// Índice único para no duplicar favoritos
favoriteZoneSchema.index({ usuario_id: 1, zona_id: 1 }, { unique: true });

module.exports = mongoose.model("FavoriteZone", favoriteZoneSchema);
