/**
 * @file Modelo de Reporte
 * @module models/Report
 * @description Modelo que gestiona reportes meteorológicos colaborativos creados por usuarios sobre condiciones
 * específicas en una zona. Incluye sistema de validación mediante confirmaciones/desmentidos de otros usuarios,
 * y se elimina automáticamente después de 48 horas. Se relaciona con User (autor), Zone (ubicación) y 
 * ReportCategory (clasificación del tipo de reporte).
 */

const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    zona_id: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    categoria_id: { type: mongoose.Schema.Types.ObjectId, ref: "ReportCategory", required: true },
    contenido: {
      // NOTE, con <= 4 caracteres peta
      descripcion: { type: String, required: true },
    },
    // Sistema de validación
    validaciones: {
      usuarios_confirmaron: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      usuarios_desmintieron: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    },
    // Lista de administradores que han visualizado este reporte en su panel para limpiar la notificación
    visto_por_admins: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    // NOTE: reports activos por defecto
    estado: { type: String, enum: ["SOSPECHOSO", "LEGITIMO"], default: "SOSPECHOSO" },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_REPORTS || "reports",
  }
);

// TTL Index - borra documentos después de 48 horas
/**
 * Índice TTL que elimina automáticamente los reportes 48 horas después de su creación.
 * Esto evita que los reportes sospechosos o temporales se acumulen indefinidamente en la base de datos.
 */
reportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model("Report", reportSchema);
