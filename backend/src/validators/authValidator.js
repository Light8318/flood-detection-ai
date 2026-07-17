/**
 * Auth Validators.
 * Each exported function takes a data object and returns
 * an array of human-readable error strings (empty = valid).
 */

const { ROLES } = require("../utils/constants");

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_ROLES = Object.values(ROLES);

/**
 * Validates the registration payload.
 * @param {object} body
 * @returns {string[]} error messages
 */
const validateRegister = (body) => {
    const errors = [];

    if (!body.name || typeof body.name !== "string" || body.name.trim().length < 2) {
        errors.push("Name must be at least 2 characters.");
    }

    if (!body.email || !EMAIL_REGEX.test(body.email)) {
        errors.push("A valid email address is required.");
    }

    if (!body.password || body.password.length < 8) {
        errors.push("Password must be at least 8 characters.");
    }

    if (body.role && !ALLOWED_ROLES.includes(body.role)) {
        errors.push(`Role must be one of: ${ALLOWED_ROLES.join(", ")}.`);
    }

    return errors;
};

/**
 * Validates the login payload.
 * @param {object} body
 * @returns {string[]} error messages
 */
const validateLogin = (body) => {
    const errors = [];

    if (!body.email || !EMAIL_REGEX.test(body.email)) {
        errors.push("A valid email address is required.");
    }

    if (!body.password || !body.password.length) {
        errors.push("Password is required.");
    }

    return errors;
};

module.exports = { validateRegister, validateLogin };
