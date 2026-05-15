/**
 * @file Modelo de Zona
 * @module models/Zone
 * @description Modelo que representa zonas geográficas del mapa para las que se recopilan datos meteorológicos.
 * Almacena ubicación (GeoJSON Point), información descriptiva y caché de datos meteorológicos actuales y predicciones.
 * Se relaciona con User a través de preferencias, y con Report y Comment para agrupar datos por zona geográfica.
 */

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
      // Datos actuales (temperatura, viento, etc.)
      current: {
        datos_crudos: mongoose.Schema.Types.Mixed,
        ultima_actualizacion: Date,
      },
      // Predicción de temperatura (próximas x horas)
      forecast: {
        datos_crudos: mongoose.Schema.Types.Mixed,
        ultima_actualizacion: Date,
      },
    },
    estado: { type: String, enum: ["ACTIVA", "INACTIVA"], default: "ACTIVA" },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_ZONES || "zones",
  }
);

// Índice geoespacial para búsquedas por proximidad
/**
 * Índice geoespacial 2dsphere que permite realizar consultas de proximidad espacial.
 * Habilita búsquedas como "encontrar zonas cercanas a una coordenada" de manera eficiente.
 */
zoneSchema.index({ geolocalizacion: "2dsphere" });

module.exports = mongoose.model("Zone", zoneSchema);
