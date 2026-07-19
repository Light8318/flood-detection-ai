/**
 * Centralized environment variable loader and validator.
 * The application will fail fast on startup if required variables are missing.
 */

const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const REQUIRED = [
    "DATABASE_URL",
    "JWT_SECRET",
];

const missing = REQUIRED.filter((key) => !process.env[key]);

if (missing.length > 0) {
    throw new Error(
        `Missing required environment variables: ${missing.join(", ")}`
    );
}

const env = {
    NODE_ENV:          process.env.NODE_ENV          || "development",
    PORT:              parseInt(process.env.PORT, 10) || 3000,

    DATABASE_URL:      process.env.DATABASE_URL,

    JWT_SECRET:        process.env.JWT_SECRET,
    JWT_EXPIRES_IN:    process.env.JWT_EXPIRES_IN    || "24h",

    GEMINI_API_KEY:    process.env.GEMINI_API_KEY    || null,
    GEMINI_MODEL:      process.env.GEMINI_MODEL      || "gemini-1.5-flash",

    N8N_WEBHOOK_URL:   process.env.N8N_WEBHOOK_URL   || null,
    RESEND_API_KEY:    process.env.RESEND_API_KEY    || null,

    // Resolve to an absolute path so Multer works regardless of cwd
    UPLOAD_DIR:        process.env.UPLOAD_DIR
        ? path.resolve(process.env.UPLOAD_DIR)
        : path.resolve(__dirname, "../../src/uploads"),
    MAX_FILE_SIZE_MB:  parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5,
};

module.exports = env;
