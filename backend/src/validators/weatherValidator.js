/**
 * Weather Validators.
 */

/**
 * Validates the weather query parameters.
 * @param {object} query
 * @returns {string[]}
 */
const validateWeatherQuery = (query) => {
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

module.exports = { validateWeatherQuery };
