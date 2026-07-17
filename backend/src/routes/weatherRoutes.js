/**
 * Weather Routes.
 * GET /api/weather          — fetch current weather + flood risk (public)
 * GET /api/weather/history  — paginated stored history (public)
 */

const express = require("express");
const router  = express.Router();

const { getWeather, getHistory } = require("../controllers/weatherController");
const { validateQuery }          = require("../middleware/validationMiddleware");
const { apiLimiter }             = require("../middleware/rateLimitMiddleware");
const { validateWeatherQuery }   = require("../validators/weatherValidator");

// /history must be declared before /:id-style params to avoid route shadowing
router.get("/history", apiLimiter, getHistory);
router.get("/",        apiLimiter, validateQuery(validateWeatherQuery), getWeather);

module.exports = router;
