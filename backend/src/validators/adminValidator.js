/**
 * Admin Validators.
 * Query-param validators for admin-specific list endpoints.
 */

const { ROLES, RISK_LEVELS } = require("../utils/constants");

const ALLOWED_ROLES       = Object.values(ROLES);
const ALLOWED_RISK_LEVELS = Object.values(RISK_LEVELS);

/**
 * Validates GET /api/admin/users query params.
 * - role:     optional, must be a valid ROLES value
 * - isActive: optional, must be "true" or "false"
 *
 * @param {object} query
 * @returns {string[]}
 */
const validateAdminUserListQuery = (query) => {
    const errors = [];

    if (query.role && !ALLOWED_ROLES.includes(query.role)) {
        errors.push(`role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
    }

    if (query.isActive !== undefined && !["true", "false"].includes(query.isActive)) {
        errors.push("isActive must be 'true' or 'false'.");
    }

    return errors;
};

/**
 * Validates GET /api/admin/predictions query params.
 * - riskLevel: optional, must be a valid RISK_LEVELS value
 * - userId:    optional, must be a positive integer
 * - reportId:  optional, must be a positive integer
 *
 * @param {object} query
 * @returns {string[]}
 */
const validateAdminPredictionListQuery = (query) => {
    const errors = [];

    if (query.riskLevel && !ALLOWED_RISK_LEVELS.includes(query.riskLevel)) {
        errors.push(`riskLevel must be one of: ${ALLOWED_RISK_LEVELS.join(", ")}.`);
    }

    if (query.userId !== undefined) {
        const id = parseInt(query.userId, 10);
        if (isNaN(id) || id < 1) errors.push("userId must be a positive integer.");
    }

    if (query.reportId !== undefined) {
        const id = parseInt(query.reportId, 10);
        if (isNaN(id) || id < 1) errors.push("reportId must be a positive integer.");
    }

    return errors;
};

module.exports = { validateAdminUserListQuery, validateAdminPredictionListQuery };
