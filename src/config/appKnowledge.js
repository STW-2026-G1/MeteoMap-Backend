/**
 * Base de conocimientos de MeteoMap para el asistente de IA.
 * Contiene instrucciones paso a paso sobre cómo utilizar las funcionalidades de la aplicación.
 */

const appKnowledge = {
  "gestion_reportes": {
    "crear_reporte": "Para crear un nuevo reporte de seguridad: 1. Selecciona una zona en el mapa o búscala en el buscador. 2. En el panel lateral de la zona, haz clic en 'Crear Reporte'. 3. Selecciona el tipo de riesgo (ej: Alerta de Nieve, Avalancha). 4. Escribe una descripción detallada de al menos 20 caracteres. 5. Haz clic en 'Publicar Reporte'.",
    "editar_reporte": "Puedes editar tus reportes desde tu Perfil: 1. Ve a la sección 'Mis Reportes'. 2. Haz clic en el icono de lápiz (editar) en el reporte deseado. 3. Modifica la categoría o descripción y guarda los cambios.",
    "eliminar_reporte": "Para borrar un reporte propio: Ve a tu Perfil -> Mis Reportes y haz clic en el icono de la papelera roja.",
    "validar_reporte": "Si ves un reporte de otro usuario, puedes confirmarlo o desmentirlo haciendo clic en los botones de 'Pulgar arriba' o 'Pulgar abajo' en el detalle del reporte para ayudar a la comunidad."
  },
  "perfil_usuario": {
    "cambiar_avatar": "MeteoMap usa avatares dinámicos de DiceBear. Para cambiar el tuyo: 1. Ve a tu Perfil. 2. Haz clic en 'Configuración'. 3. En la sección de Perfil, verás un selector de 'Estilo de Avatar'. 4. Elige entre estilos como 'Avataaars', 'Bottts', 'Pixel Art', etc. y haz clic en 'Guardar Cambios'.",
    "cambiar_password": "Dentro de Perfil -> Configuración, encontrarás la opción 'Seguridad' para cambiar tu contraseña actual por una nueva.",
    "biografia": "Puedes actualizar tu biografía y ubicación desde la pestaña de Configuración en tu Perfil."
  },
  "comentarios_y_foro": {
    "añadir_comentario": "Cada zona tiene su propio foro de discusión: 1. Selecciona una zona. 2. En el panel lateral, haz clic en 'Ir al foro'. 3. Al final del foro verás un cuadro de texto para escribir tu comentario (mínimo 10 caracteres). 4. Haz clic en el icono de enviar.",
    "responder_comentario": "En el foro, haz clic en 'Responder' debajo del comentario de otro usuario para crear un hilo de conversación.",
    "reacciones": "Puedes dar 'Me gusta' a los comentarios de otros usuarios haciendo clic en el icono del pulgar azul."
  },
  "mapa": {
    "busqueda_zonas": "Usa la barra de búsqueda en la parte superior izquierda del mapa para encontrar picos, valles o estaciones de esquí por nombre.",
    "alertas_aemet": "Los círculos rojos/naranjas en el mapa representan alertas oficiales de AEMET. Haz clic en ellos para ver la descripción oficial, nivel de urgencia y recomendaciones de seguridad."
  },
  "favoritos": {
    "añadir_favorito": "Para guardar una zona, haz clic en el icono del corazón que aparece junto al nombre de la zona en el buscador o en el panel lateral.",
    "ver_favoritos": "Tus zonas guardadas aparecen en la sección 'Zonas Favoritas' de tu Perfil para un acceso rápido."
  },
  "asistente_ia": {
    "uso": "Puedes preguntarme sobre el tiempo en cualquier zona, pedirme un resumen de seguridad o consultarme cómo realizar cualquier acción en la aplicación."
  }
};

/**
 * Obtiene la información solicitada del manual.
 * @param {string} query - El tema o palabra clave a buscar.
 * @returns {string} - La información encontrada o un mensaje por defecto.
 */
function getHelp(query) {
  if (!query) return "Puedo ayudarte con reportes, perfil, comentarios, favoritos y el uso del mapa. ¿Qué necesitas saber?";

  const q = query.toLowerCase();
  let response = "";

  // Búsqueda simple en las categorías
  for (const category in appKnowledge) {
    for (const key in appKnowledge[category]) {
      if (key.includes(q) || appKnowledge[category][key].toLowerCase().includes(q) || category.includes(q)) {
        response += appKnowledge[category][key] + "\n\n";
      }
    }
  }

  return response || "Lo siento, no tengo instrucciones específicas sobre eso en mi manual. Intenta preguntar sobre reportes, avatar, comentarios o el mapa.";
}

module.exports = { appKnowledge, getHelp };
