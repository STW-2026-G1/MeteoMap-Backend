require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");

const logger = require("../src/config/logger");
const swaggerSpec = require("../src/config/swagger");
const { connect } = require("../src/config/database");
const httpLogger = require("../src/middleware/httpLogger");
const { notFound, errorHandler } = require("../src/middleware/errorHandler");
const isAuth = require("../src/middleware/auth");
const requireAdmin = require("../src/middleware/requireAdmin");

// Import routers
const authRouter = require("../src/routes/auth");
const usersRouter = require("../src/routes/users");
const zonesRouter = require("../src/routes/zones");
const reportsRouter = require("../src/routes/reports");
const categoriesRouter = require("../src/routes/categories");
const commentsRouter = require("../src/routes/comments");
const chatRouter = require("../src/routes/chat");
const adminRouter = require("../src/routes/admin");
const aemetAlertsRouter = require("../src/routes/aemet-alerts");

// App setup
const app = express();

// Security & parsing
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Error logger
app.use(httpLogger.errorLogger);

// HTTP request logging
app.use(httpLogger);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), version: "1.0.0" });
});

// Redirect root to API docs
app.get("/", (req, res) => {
  res.redirect(302, "/docs");
});

// Swagger UI served from CDN so Vercel does not need to proxy local assets.
app.get("/docs", (req, res) => {
  const specJson = JSON.stringify(swaggerSpec);

  res.type("html").send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mountain Safety Platform API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #f7f7f9; }
      #swagger-ui { max-width: 100vw; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          spec: ${specJson},
          dom_id: '#swagger-ui',
          deepLinking: true,
          persistAuthorization: true,
          displayRequestDuration: true,
          presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
          layout: 'StandaloneLayout'
        });
      };
    </script>
  </body>
</html>`);
});

// Expose raw OpenAPI spec
app.get("/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// Connect MongoDB before any API route can execute a query.
// This is skipped for /health, /, /docs and /docs.json so those stay fast.
let dbConnectPromise;

async function ensureDatabaseConnection() {
  if (!dbConnectPromise) {
    dbConnectPromise = connect().catch((err) => {
      dbConnectPromise = undefined;
      throw err;
    });
  }

  return dbConnectPromise;
}

app.use("/api", async (req, res, next) => {
  try {
    await ensureDatabaseConnection();
    next();
  } catch (err) {
    logger.error("Database connection failed", { error: err.message });
    return res.status(500).json({ error: "Database connection failed" });
  }
});

// API routes
app.use("/api/auth", authRouter);
app.use("/api/user", usersRouter);
app.use("/api/zones", zonesRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/categories", categoriesRouter);
app.use("/api/comments", commentsRouter);
app.use("/api/chat", chatRouter);
app.use("/api/aemet-alerts", aemetAlertsRouter);
app.use("/api/admin", isAuth, requireAdmin, adminRouter);

// Error handling
app.use(notFound);
app.use(errorHandler);

module.exports = app;
