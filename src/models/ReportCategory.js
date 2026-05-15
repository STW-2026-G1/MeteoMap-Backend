/**
 * @file Modelo de Categoría de Reporte
 * @module models/ReportCategory
 * @description Modelo que define las categorías disponibles para clasificar reportes meteorológicos.
 * Cada categoría incluye nombre único, descripción e ícono de marcador para visualizar en mapas.
 * Se relaciona con Report mediante categoria_id para categorizar los reportes del sistema.
 */

const mongoose = require("mongoose");

const reportCategorySchema = new mongoose.Schema(
  {
    nombre: { type: String, required: true, unique: true },
    descripcion: String,
    icono_marcador: String,
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_CATEGORIES || "report_categories",
  }
);

module.exports = mongoose.model("ReportCategory", reportCategorySchema);
