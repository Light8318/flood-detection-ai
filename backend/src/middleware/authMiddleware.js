/**
 * JWT Authentication Middleware.
 * Validates the Bearer token from the Authorization header.
 * Attaches the decoded user payload to req.user.
 */

const { verifyToken } = require("../utils/jwt");
const response = require("../utils/responseFormatter");

const authenticate = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return response.error(res, "Authorization token is required.", 401);
    }

    const token = authHeader.split(" ")[1];

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch {
        return response.error(res, "Invalid or expired token.", 401);
    }
};

module.exports = { authenticate };
