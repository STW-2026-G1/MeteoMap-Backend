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
    // NOTE: reports activos por defecto
    estado: { type: String, enum: ["SOSPECHOSO", "LEGITIMO"], default: "SOSPECHOSO" },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_REPORTS || "reports",
  }
);

// TTL Index - borra documentos después de 48 horas
reportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

module.exports = mongoose.model("Report", reportSchema);
