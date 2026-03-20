require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");

const logger = require("./config/logger");
const swaggerSpec = require("./config/swagger");
const { connect, disconnect } = require("./config/database");
const httpLogger = require("./middleware/httpLogger");
const { notFound, errorHandler } = require("./middleware/errorHandler");

// Import new routers
const authRouter = require("./routes/auth");
const usersRouter = require("./routes/users");
const zonesRouter = require("./routes/zones");
const reportsRouter = require("./routes/reports");
const commentsRouter = require("./routes/comments");
const chatRouter = require("./routes/chat");
const adminRouter = require("./routes/admin");

// ---------------------------------------------------------------------------
// Ensure log directory exists
// ---------------------------------------------------------------------------
fs.mkdirSync(path.join(process.cwd(), "logs"), { recursive: true });

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------
const app = express();

// Security & parsing
app.use(helmet({ contentSecurityPolicy: false })); // CSP off so Swagger UI loads
app.use(cors());
app.use(express.json());

// HTTP request logging
app.use(httpLogger);

// ---------------------------------------------------------------------------
// Health check (before API prefix so load balancers can hit it easily)
// ---------------------------------------------------------------------------

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:  { type: string, example: ok }
 *                 uptime:  { type: number, example: 42.3 }
 *                 version: { type: string, example: "1.0.0" }
 */
app.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), version: "1.0.0" });
});

// ---------------------------------------------------------------------------
// Swagger UI
// ---------------------------------------------------------------------------
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Mountain Safety Platform API Docs",
    swaggerOptions: { persistAuthorization: true },
  })
);

// Expose raw OpenAPI spec for tooling
app.get("/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
// Authentication endpoints
app.use("/api/auth", authRouter);

// User management endpoints
app.use("/api/user", usersRouter);

// Zone management and weather endpoints
app.use("/api/zones", zonesRouter);

// Community reports endpoint
app.use("/api/reports", reportsRouter);

// Comments and forum endpoints
app.use("/api/comments", commentsRouter);

// Chat and IA endpoint
app.use("/api/chat", chatRouter);

// Admin panel endpoints
app.use("/api/admin", adminRouter);

// ---------------------------------------------------------------------------
// Error handling (must be LAST)
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = parseInt(process.env.PORT || "3000", 10);

async function start() {
  try {
    await connect();

    app.listen(PORT, () => {
      logger.info(`Server running on http://localhost:${PORT}`);
      logger.info(`Swagger UI:  http://localhost:${PORT}/docs`);
      logger.info(`OpenAPI JSON:http://localhost:${PORT}/docs.json`);
      logger.info(`Health:      http://localhost:${PORT}/health`);
    });
  } catch (err) {
    logger.error("Failed to start server", { error: err.message });
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGTERM", async () => {
  logger.info("SIGTERM received — shutting down gracefully");
  await disconnect();
  process.exit(0);
});

process.on("SIGINT", async () => {
  logger.info("SIGINT received — shutting down gracefully");
  await disconnect();
  process.exit(0);
});

start();