const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    zona_id: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    reporte_id: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
    contenido: { type: String, required: true },
    etiqueta: String,
    estado: { type: String, enum: ["ACTIVO", "SPAM", "ELIMINADO"], default: "ACTIVO" },
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_COMMENTS || "comments",
  }
);

module.exports = mongoose.model("Comment", commentSchema);
