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
