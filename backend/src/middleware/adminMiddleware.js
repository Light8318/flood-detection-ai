/**
 * Admin Role Middleware.
 * Must be used after authenticate middleware.
 * Rejects requests from non-admin users.
 */

const { ROLES } = require("../utils/constants");
const response  = require("../utils/responseFormatter");

const requireAdmin = (req, res, next) => {
    if (!req.user || req.user.role !== ROLES.ADMIN) {
        return response.error(res, "Access denied. Admins only.", 403);
    }
    next();
};

module.exports = { requireAdmin };
