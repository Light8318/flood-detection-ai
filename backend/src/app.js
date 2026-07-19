/**
 * Express Application.
 * Configures middleware and mounts all route modules.
 * Exported for use in server.js (and for testing).
 */

const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./docs/swagger");

const { errorHandler } = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/authMiddleware");
const { requireAdmin } = require("./middleware/adminMiddleware");
const logger = require("./config/logger");
const env = require("./config/env");

// Route modules
// Register global error listeners to prevent silent failures and log uncaught exceptions/rejections
process.on("uncaughtException", (err) => {
    logger.error("UNCAUGHT EXCEPTION: " + err.message, { stack: err.stack });
    console.error(`[${new Date().toISOString()}] [CRITICAL] UNCAUGHT EXCEPTION:`, err);
});

process.on("unhandledRejection", (reason, promise) => {
    logger.error("UNHANDLED REJECTION", { reason: String(reason) });
    console.error(`[${new Date().toISOString()}] [CRITICAL] UNHANDLED REJECTION at:`, promise, "reason:", reason);
});
const healthRoute = require("./routes/health");
const authRoutes = require("./routes/authRoutes");
const weatherRoutes = require("./routes/weatherRoutes");
const reportRoutes = require("./routes/reportRoutes");
const predictionRoutes = require("./routes/predictionRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();

// ── Security headers ─────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: false,
}));

// ── CORS ─────────────────────────────────────────────────────────────────────
app.use(cors());

// ── Body parsers ────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Static uploads ──────────────────────────────────────────────────────────
app.use("/uploads", express.static(env.UPLOAD_DIR));

// ── Request logging ─────────────────────────────────────────────────────────
app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.originalUrl}`, { ip: req.ip });
    next();
});

// ── Routes ───────────────────────────────────────────────────────────────────
app.get("/", (_req, res) => {
    res.json({
        success: true,
        message: "Flood Detection AI API is running.",
        timestamp: new Date().toISOString(),
    });
});

app.use("/health", healthRoute);
app.use("/api/auth", authRoutes);
app.use("/api/weather", weatherRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/predictions", predictionRoutes);
app.use("/api/admin", adminRoutes);

// ── Swagger UI (admin-only in production) ────────────────────────────────────
const docsGuard =
    env.NODE_ENV === "production"
        ? [authenticate, requireAdmin]
        : [];
app.use(
    "/api/docs",
    ...docsGuard,
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
        customSiteTitle: "Flood Detection AI — API Docs",
        swaggerOptions: {
            persistAuthorization: true,      // keeps the Bearer token across page refreshes
            displayRequestDuration: true,
            docExpansion: "none",            // collapse all tags by default
            filter: true,                    // show search box
            tryItOutEnabled: false,          // require explicit "Try it out" click
        },
    })
);

// Raw OpenAPI JSON — also guarded in production
app.get("/api/docs.json", ...docsGuard, (_req, res) => res.json(swaggerSpec));

// ── 404 handler ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found.",
        data: null,
        timestamp: new Date().toISOString(),
    });
});

// ── Centralized error handler (must be last) ─────────────────────────────────
app.use(errorHandler);

module.exports = app;
