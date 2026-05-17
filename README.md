# MeteoMap - Backend

API REST para la plataforma de seguridad en montaña MeteoMap. Proporciona gestión de zonas, datos meteorológicos, reportes comunitarios y orientación asistida por IA.

> Nota: Para obtener información más detallada, consultar el pdf de documentación en la carpeta `docs/`.

## Características Principales

*   **Autenticación y Autorización:** Registro, inicio de sesión (Local y Google OAuth2) y roles (USER, ADMIN) con JWT.
*   **Gestión de Zonas:** Información geográfica (GeoJSON), meteorología en caché y dashboards de estadísticas.
*   **Reportes y Comunidad:** Creación de reportes geolocalizados, validación comunitaria, comentarios y foros por zona.
*   **Asistente Inteligente:** Integración con IA (Mistral Small) para resolver dudas sobre seguridad y condiciones en montaña.
*   **Monitorización:** Registro avanzado con Winston y métricas de sistema accesibles para administradores.

## Stack Tecnológico

*   **Entorno:** Node.js, Express.js
*   **Base de Datos:** MongoDB (Mongoose)
*   **Autenticación:** JWT, Google Auth Library, bcrypt
*   **Documentación:** Swagger / OpenAPI
*   **Otros:** Zod, express-validator, node-cron (tareas programables)

## Requisitos y Configuración

1.  Asegúrate de tener Node.js (>= 18) y MongoDB (>= 6) instalados.
2.  Instala las dependencias:
    ```bash
    npm install
    ```
3.  Copia `.env.example` a `.env` y configura las variables de entorno necesarias (conexión a DB, secretos JWT, claves de Google/IA, etc.).

## Ejecución

*   **Desarrollo:**
    ```bash
    npm run dev
    ```
*   **Producción:**
    ```bash
    npm start
    ```

## Documentación de la API

Una vez iniciado el servidor, puedes acceder a la especificación interactiva de la API mediante swagger en:
`http://localhost:3000/docs`
