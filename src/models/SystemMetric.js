/**
 * @file Modelo de Métrica del Sistema
 * @module models/SystemMetric
 * @description Modelo que registra métricas del sistema para monitoreo y análisis. Captura eventos como
 * errores, latencias, uso de tokens en API de IA y nuevos reportes. Cada métrica incluye origen del evento,
 * tipo específico, valor numérico y detalles adicionales en formato libre.
 */

const mongoose = require("mongoose");

const metricSchema = new mongoose.Schema(
  {
    origen: {
      type: String,
      enum: ["CHATBOT", "API_METEO", "AUTH", "SISTEMA"],
      required: true,
    },
    tipo: {
      type: String,
      enum: ["ERROR", "LATENCIA", "USO_TOKEN", "NUEVO_REPORTE"],
      required: true,
    },
    valor: { type: Number, required: true },
    detalles: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_METRICS || "system_metrics",
  }
);

module.exports = mongoose.model("SystemMetric", metricSchema);
