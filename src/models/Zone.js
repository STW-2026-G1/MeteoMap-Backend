const mongoose = require("mongoose");

const zoneSchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true },
    descripcion: String,
    // GeoJSON para queries espaciales
    geolocalizacion: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [Longitud, Latitud]
    },
    // Cache de datos meteorológicos
    cache_meteo: {
      datos_crudos: mongoose.Schema.Types.Mixed,
      ultima_actualizacion: Date,
    },
    estado: { type: String, enum: ["ACTIVA", "INACTIVA"], default: "ACTIVA" },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_ZONES || "zones",
  }
);

// Índice geoespacial para búsquedas por proximidad
zoneSchema.index({ geolocalizacion: "2dsphere" });

module.exports = mongoose.model("Zone", zoneSchema);
