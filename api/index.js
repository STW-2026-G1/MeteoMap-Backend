require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const swaggerUi = require("swagger-ui-express");
const fs = require("fs");
const path = require("path");

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

// Ensure log directory exists
fs.mkdirSync(path.join(process.cwd(), "logs"), { recursive: true });

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

// Swagger UI
app.use(
  "/docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: "Mountain Safety Platform API Docs",
    swaggerOptions: { persistAuthorization: true },
  })
);

// Expose raw OpenAPI spec
app.get("/docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
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

// Initialize database on first request
let dbConnected = false;
app.use(async (req, res, next) => {
  if (!dbConnected) {
    try {
      await connect();
      dbConnected = true;
    } catch (err) {
      logger.error("Database connection failed", { error: err.message });
      return res.status(500).json({ error: "Database connection failed" });
    }
  }
  next();
});

module.exports = app;
