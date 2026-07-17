/**
 * Application logger using the built-in console with structured output.
 * Wraps console methods so the log level and timestamp are always present.
 * Replace with Winston / Pino when a file-transport is needed.
 */

const env = require("./env");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const ACTIVE_LEVEL = LEVELS[env.NODE_ENV === "production" ? "info" : "debug"];

const timestamp = () => new Date().toISOString();

const shouldLog = (level) => LEVELS[level] <= ACTIVE_LEVEL;

const format = (level, message, meta) => {
    const base = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;
    return meta ? `${base} ${JSON.stringify(meta)}` : base;
};

const logger = {
    error: (message, meta) => {
        if (shouldLog("error")) console.error(format("error", message, meta));
    },
    warn: (message, meta) => {
        if (shouldLog("warn")) console.warn(format("warn", message, meta));
    },
    info: (message, meta) => {
        if (shouldLog("info")) console.info(format("info", message, meta));
    },
    debug: (message, meta) => {
        if (shouldLog("debug")) console.debug(format("debug", message, meta));
    },
};

module.exports = logger;
