const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    zona_id: { type: mongoose.Schema.Types.ObjectId, ref: "Zone", required: true },
    // Información de categoría embebida directamente (no referencia)
    categoria: {
      nombre: { type: String, required: true },
      icono_marcador: { type: String, required: true },
    },
    // Ubicación exacta del reporte (puede diferir del centro de la zona)
    geolocalizacion: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true },
    },
    tipo: { type: String, required: true },
    contenido: {
      descripcion: { type: String, required: true },
      foto_url: String,
    },
    // Sistema de validación
    validaciones: {
      confirmaciones: { type: Number, default: 0 },
      desmentidos: { type: Number, default: 0 },
    },
    estado: { type: String, enum: ["PENDIENTE", "ACTIVO", "OCULTO", "SPAM"], default: "PENDIENTE" },
    valoracion_global: { type: Number, default: 0 },
    // Array de comentarios embebidos (si esperas <50 comentarios por reporte)
    comentarios: [
      {
        usuario_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        autor_nombre: String, // Desnormalizado para no hacer populate en cada acceso
        contenido: { type: String, required: true },
        etiqueta: String,
        estado: { type: String, enum: ["ACTIVO", "SPAM", "ELIMINADO"], default: "ACTIVO" },
        fecha: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    collection: process.env.MONGODB_COLLECTION_REPORTS || "reports",
  }
);

// TTL Index - borra documentos después de 48 horas
reportSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });
// Índice geoespacial
reportSchema.index({ geolocalizacion: "2dsphere" });

module.exports = mongoose.model("Report", reportSchema);
