const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Si es un comentario de zona general
    zona_id: { type: mongoose.Schema.Types.ObjectId, ref: "Zone" }, 
    // Si es un comentario de un reporte meteorológico específico
    reporte_id: { type: mongoose.Schema.Types.ObjectId, ref: "Report" },
    contenido: { type: String, required: true },
    parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null }, // Para respuestas
    likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_COMMENTS || "comments",
  }
);

module.exports = mongoose.model("Comment", commentSchema);
