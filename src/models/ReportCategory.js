const mongoose = require("mongoose");

const reportCategorySchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true },
    descripcion: String,
    icono_marcador: String,
    estado: { type: String, enum: ["ACTIVA", "INACTIVA"], default: "ACTIVA" },
    creado_por: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_CATEGORIES || "report_categories",
  }
);

module.exports = mongoose.model("ReportCategory", reportCategorySchema);
