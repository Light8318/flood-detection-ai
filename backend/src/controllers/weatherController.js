/**
 * Weather Controller.
 * Receives HTTP requests and delegates to weatherService.
 * Returns standardized API responses.
 */

const weatherService = require("../services/weatherService");
const response       = require("../utils/responseFormatter");

/**
 * GET /api/weather?lat=&lon=
 * Fetches current weather + flood risk for given coordinates.
 */
const getWeather = async (req, res, next) => {
    try {
        const { lat, lon } = req.query;
        const weather      = await weatherService.getWeather(lat, lon);
        return response.success(res, "Weather data retrieved successfully.", weather);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/weather/history?page=&limit=&locationId=
 * Returns stored weather history, newest first.
 */
const getHistory = async (req, res, next) => {
    try {
        const result = await weatherService.getHistory(req.query);
        return response.success(res, "Weather history retrieved successfully.", result);
    } catch (err) {
        next(err);
    }
};

module.exports = { getWeather, getHistory };
