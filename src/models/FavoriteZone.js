const mongoose = require("mongoose");

const favoriteZoneSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    zona_id: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_FAVORITES || "favorite_zones",
  }
);

// Índice único para no duplicar favoritos
favoriteZoneSchema.index({ usuario_id: 1, zona_id: 1 }, { unique: true });

module.exports = mongoose.model("FavoriteZone", favoriteZoneSchema);
