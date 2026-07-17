/**
 * Centralized Error Handler Middleware.
 * Must be the last middleware registered in app.js.
 * Catches all errors forwarded via next(err).
 */

const logger   = require("../config/logger");
const response = require("../utils/responseFormatter");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
    logger.error(err.message, { stack: err.stack, path: req.path });

    // Prisma known request errors (e.g. unique constraint violations)
    if (err.code === "P2002") {
        return response.error(
            res,
            "A record with the provided data already exists.",
            409
        );
    }

    // Prisma record not found
    if (err.code === "P2025") {
        return response.error(res, "Record not found.", 404);
    }

    const statusCode = err.statusCode || err.status || 500;
    const message    = err.message    || "Internal server error.";

    return response.error(res, message, statusCode);
};

module.exports = { errorHandler };
