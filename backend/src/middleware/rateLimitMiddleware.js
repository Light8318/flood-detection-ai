const env    = require("../config/env");

/**
 * Creates a rate-limiter middleware.
 * @param {object} options
 * @param {number} options.windowMs   - Window size in milliseconds
 * @param {number} options.max        - Max requests allowed in the window
 * @param {string} [options.message]  - Custom rejection message
 * @returns {Function} Express middleware
 */
const createRateLimiter = ({ windowMs, max, message }) => {
    // Isolated store for this limiter instance
    const store = new Map();
    const errorMessage = message || "Too many requests. Please try again later.";

    return (req, res, next) => {
        const ip  = req.ip || req.socket?.remoteAddress || "unknown";
        const now = Date.now();

        const record = store.get(ip);

        if (!record || now > record.resetAt) {
            store.set(ip, { count: 1, resetAt: now + windowMs });
            return next();
        }

        record.count += 1;

        if (record.count > max) {
            return res.status(429).json({
                success:   false,
                message:   errorMessage,
                data:      null,
                timestamp: new Date().toISOString(),
            });
        }

        next();
    };
};

// Pre-built limiters for common route groups
// Bypassed completely in development to prevent issues during testing
const authLimiter = env.NODE_ENV === "development"
    ? (req, res, next) => next()
    : createRateLimiter({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max:      20,
        message:  "Too many authentication attempts. Please try again later.",
      });

const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max:      60,
});

const uploadLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max:      10,
    message:  "Too many upload requests. Please try again later.",
});

module.exports = { createRateLimiter, authLimiter, apiLimiter, uploadLimiter };
