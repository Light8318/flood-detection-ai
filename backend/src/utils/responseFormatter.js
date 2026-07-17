/**
 * Produces the standard API envelope:
 * { success, message, data, timestamp }
 */

const success = (res, message, data = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message,
        data,
        timestamp: new Date().toISOString(),
    });
};

const error = (res, message, statusCode = 500, data = null) => {
    return res.status(statusCode).json({
        success: false,
        message,
        data,
        timestamp: new Date().toISOString(),
    });
};

module.exports = { success, error };
