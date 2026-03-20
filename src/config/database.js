const mongoose = require("mongoose"); 
const logger = require("./logger");

// Función principal (asíncrona) para establecer la conexión a la base de datos
async function connect() {
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017/";
  const dbName = process.env.MONGODB_DB || "imdb";

  // Le dice a Mongoose que sea estricto. Si buscas atributos que no existen 
  // en tu esquema, Mongoose los ignorará en lugar de lanzar errores raros.
  mongoose.set("strictQuery", true);

  // Si le decimos al servidor que estamos buscando errores
  if (process.env.LOG_LEVEL === "debug") {
    // Le pedimos a Mongoose que nos diga absolutamente todas las consultas que hace a la base de datos.
    // En lugar de imprimirlo feo en la consola, se lo pasamos a nuestro propio `logger` para que lo guarde bonito.
    mongoose.set("debug", (collectionName, method, query, doc) => {
      logger.debug(`Mongoose: ${collectionName}.${method}`, { query, doc });
    });
  }

  // Junta la URI y el nombre de la base de datos y se conecta.
  await mongoose.connect(`${uri.replace(/\/$/, "")}/${dbName}`);
  
  logger.info("MongoDB connected via Mongoose", { uri, db: dbName });
}

// Función para apagar la conexión limpiamente
async function disconnect() {
  await mongoose.disconnect();
  logger.info("MongoDB disconnected");
}

module.exports = { connect, disconnect };