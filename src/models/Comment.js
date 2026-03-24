const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Si es un comentario de zona general
    zona_id: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" }, 
    // Si es un comentario de un reporte meteorológico específico
    reporte_id: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
    contenido: { type: String, required: true },
    etiqueta: String, // La "categoría"
    estado: { type: String, enum: ["ACTIVO", "SPAM", "ELIMINADO"], default: "ACTIVO" },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_COMMENTS || "comments",
  }
);

module.exports = mongoose.model("Comment", commentSchema);
