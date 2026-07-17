/**
 * Report Validators.
 */

const { REPORT_STATUS, REPORT_SEVERITY } = require("../utils/constants");

const ALLOWED_STATUSES  = Object.values(REPORT_STATUS);
const ALLOWED_SEVERITIES = Object.values(REPORT_SEVERITY);

/**
 * Validates a new report submission.
 * @param {object} body
 * @returns {string[]}
 */
const validateCreateReport = (body) => {
    const errors = [];

    if (!body.description || body.description.trim().length < 10) {
        errors.push("Description must be at least 10 characters.");
    }

    if (!body.address || body.address.trim().length < 3) {
        errors.push("Address is required.");
    }

    if (body.latitude !== undefined && isNaN(parseFloat(body.latitude))) {
        errors.push("Latitude must be a valid number.");
    }

    if (body.longitude !== undefined && isNaN(parseFloat(body.longitude))) {
        errors.push("Longitude must be a valid number.");
    }

    return errors;
};

/**
 * Validates a report status update (admin action).
 * @param {object} body
 * @returns {string[]}
 */
const validateUpdateReportStatus = (body) => {
    const errors = [];

    if (!body.status || !ALLOWED_STATUSES.includes(body.status)) {
        errors.push(`Status must be one of: ${ALLOWED_STATUSES.join(", ")}.`);
    }

    if (body.severity && !ALLOWED_SEVERITIES.includes(body.severity)) {
        errors.push(`Severity must be one of: ${ALLOWED_SEVERITIES.join(", ")}.`);
    }

    return errors;
};

module.exports = { validateCreateReport, validateUpdateReportStatus };
