/**
 * Prediction Validators.
 */

const { RISK_LEVELS } = require("../utils/constants");
const ALLOWED_RISK_LEVELS = Object.values(RISK_LEVELS);

/**
 * Validates the flood prediction trigger query params (lat / lon).
 * Used on POST /api/predictions when coordinates are supplied directly.
 *
 * @param {object} query  - req.query
 * @returns {string[]}
 */
const validatePredictionQuery = (query) => {
    const errors = [];

    const lat = parseFloat(query.lat);
    const lon = parseFloat(query.lon);

    if (!query.lat || isNaN(lat) || lat < -90 || lat > 90) {
        errors.push("A valid latitude (-90 to 90) is required.");
    }

    if (!query.lon || isNaN(lon) || lon < -180 || lon > 180) {
        errors.push("A valid longitude (-180 to 180) is required.");
    }

    return errors;
};

/**
 * Validates the optional POST body for a prediction request.
 * - reportId: must be a positive integer when provided
 *
 * @param {object} body  - req.body
 * @returns {string[]}
 */
const validatePredictionBody = (body) => {
    const errors = [];

    if (body.reportId !== undefined) {
        const id = parseInt(body.reportId, 10);
        if (isNaN(id) || id < 1) {
            errors.push("reportId must be a positive integer.");
        }
    }

    return errors;
};

/**
 * Validates GET /api/predictions list query params.
 * - riskLevel: optional, must match RISK_LEVELS enum
 * - reportId: optional positive integer filter
 *
 * @param {object} query  - req.query
 * @returns {string[]}
 */
const validatePredictionListQuery = (query) => {
    const errors = [];

    if (query.riskLevel && !ALLOWED_RISK_LEVELS.includes(query.riskLevel)) {
        errors.push(`riskLevel must be one of: ${ALLOWED_RISK_LEVELS.join(", ")}.`);
    }

    if (query.reportId !== undefined) {
        const id = parseInt(query.reportId, 10);
        if (isNaN(id) || id < 1) {
            errors.push("reportId filter must be a positive integer.");
        }
    }

    return errors;
};

module.exports = {
    validatePredictionQuery,
    validatePredictionBody,
    validatePredictionListQuery,
};
