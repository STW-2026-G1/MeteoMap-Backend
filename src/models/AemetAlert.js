const mongoose = require("mongoose");

const aemetAlertSchema = new mongoose.Schema(
  {
    // ID único de la alerta de AEMET
    aemet_id: { type: String, required: true, unique: true, index: true },
    
    // Información de la alerta
    zona: String,
    tipo: String,
    nivel: { type: String },
    nivelNumerico: Number,
    
    // Descripción y coordenadas
    descripcion: String,
    instrucciones: String,
    probabilidad: String,
    certidumbre: String,
    urgencia: String,
    enlace: String,

    coordenadas: {
      latitud: Number,
      longitud: Number,
    },
    
    // Colores y validez
    color: String, //Color en hexa
    emision: Date,
    validez_inicio: Date,
    validez_fin: Date,
    
    // Timestamp de cuando fue procesada por primera vez
    fecha_procesamiento: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_AEMET_ALERTS || "aemet_alerts",
  }
);

// Índice por AEMET ID para búsquedas rápidas
aemetAlertSchema.index({ aemet_id: 1 });

// Índice para limpiar alertas expiradas automáticamente
aemetAlertSchema.index(
  { validez_fin: 1 },
  { expireAfterSeconds: 0 } // TTL index: documento se elimina cuando validez_fin < ahora
);

module.exports = mongoose.model("AemetAlert", aemetAlertSchema);
