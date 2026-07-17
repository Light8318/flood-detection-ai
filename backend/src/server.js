/**
 * Server Entry Point.
 * Loads environment config, then starts the HTTP server.
 */

const env    = require("./config/env");   // validates env vars first
const app    = require("./app");
const logger = require("./config/logger");
const prisma = require("./config/prisma");

const { PORT } = env;

const start = async () => {
    try {
        // Verify database connectivity before accepting traffic
        await prisma.$connect();
        logger.info("Database connection established.");

        app.listen(PORT, () => {
            logger.info(`Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        logger.error("Failed to start server.", { message: err.message });
        await prisma.$disconnect();
        process.exit(1);
    }
};

// Graceful shutdown
process.on("SIGTERM", async () => {
    logger.info("SIGTERM received — shutting down gracefully.");
    await prisma.$disconnect();
    process.exit(0);
});

process.on("SIGINT", async () => {
    logger.info("SIGINT received — shutting down gracefully.");
    await prisma.$disconnect();
    process.exit(0);
});

start();
