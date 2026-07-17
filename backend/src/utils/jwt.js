/**
 * JWT helpers — centralise sign/verify so the secret is never
 * scattered across the codebase.
 */

const jwt = require("jsonwebtoken");
const env = require("../config/env");

/**
 * Signs a payload and returns a token string.
 * @param {object} payload
 * @returns {string}
 */
const signToken = (payload) => {
    return jwt.sign(payload, env.JWT_SECRET, {
        expiresIn: env.JWT_EXPIRES_IN,
    });
};

/**
 * Verifies a token and returns the decoded payload.
 * Throws a JsonWebTokenError on failure.
 * @param {string} token
 * @returns {object}
 */
const verifyToken = (token) => {
    return jwt.verify(token, env.JWT_SECRET);
};

module.exports = { signToken, verifyToken };
