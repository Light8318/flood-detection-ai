/**
 * Validation Middleware.
 * Executes a validator schema object (containing validate functions)
 * and returns 422 on failure with a list of error messages.
 */

const response = require("../utils/responseFormatter");

/**
 * Returns a middleware that runs the given validator against req.body.
 * @param {Function} validator - A function (body) => string[] of error messages
 */
const validate = (validator) => (req, res, next) => {
    const errors = validator(req.body);

    if (errors.length > 0) {
        return response.error(res, errors[0], 422, { errors });
    }

    next();
};

/**
 * Returns a middleware that runs the given validator against req.query.
 * @param {Function} validator - A function (query) => string[] of error messages
 */
const validateQuery = (validator) => (req, res, next) => {
    const errors = validator(req.query);

    if (errors.length > 0) {
        return response.error(res, errors[0], 422, { errors });
    }

    next();
};

module.exports = { validate, validateQuery };
