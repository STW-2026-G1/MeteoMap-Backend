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
