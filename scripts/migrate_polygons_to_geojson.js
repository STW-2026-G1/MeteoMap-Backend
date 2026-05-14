const mongoose = require('mongoose');
const AemetAlert = require('../src/models/AemetAlert');
const logger = require('../src/config/logger');

// Script de migración: convierte poligono_raw -> poligono_geojson para documentos existentes
// Usage: node scripts/migrate_polygons_to_geojson.js

async function main() {
  const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI || 'mongodb://localhost:27017/meteomap';
  logger.info(`Conectando a MongoDB: ${mongoUri}`);
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    const batchSize = 200;
    let skip = 0;
    while (true) {
      const docs = await AemetAlert.find({ poligono_raw: { $ne: null }, poligono_geojson: { $in: [null, undefined] } })
        .skip(skip)
        .limit(batchSize)
        .lean();

      if (!docs || docs.length === 0) break;

      logger.info(`Procesando lote: ${skip} - ${skip + docs.length}`);

      for (const doc of docs) {
        try {
          // Lógica simple para convertir el campo poligono_raw (string) en GeoJSON
          const raw = doc.poligono_raw;
          if (!raw) continue;

          // Si el raw contiene '|' asumimos varios polígonos
          const parts = raw.includes('|') ? raw.split('|').map(s => s.trim()) : [raw.trim()];

          const coordsArray = [];
          for (const part of parts) {
            const pts = part.split(/\s+/).map(p => {
              const [latStr, lonStr] = p.split(',');
              return [parseFloat(lonStr), parseFloat(latStr)];
            }).filter(c => Number.isFinite(c[0]) && Number.isFinite(c[1]));
            if (pts.length >= 3) coordsArray.push(pts);
          }

          let geojson = null;
          if (coordsArray.length === 1) geojson = { type: 'Polygon', coordinates: [coordsArray[0]] };
          else if (coordsArray.length > 1) geojson = { type: 'MultiPolygon', coordinates: coordsArray.map(c => [c]) };

          if (geojson) {
            await AemetAlert.updateOne({ _id: doc._id }, { $set: { poligono_geojson: geojson } });
            logger.info(`Migrado doc ${doc._id}`);
          } else {
            logger.warn(`No se pudo convertir polígono para ${doc._id}`);
          }
        } catch (err) {
          logger.error(`Error migrando doc ${doc._id}: ${err.message}`);
        }
      }

      skip += docs.length;
    }

    logger.info('Migración completada');
  } catch (err) {
    logger.error(`Error en migración: ${err.message}`);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
