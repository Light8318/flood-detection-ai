/**
 * Weather Service.
 * Fetches live weather from Open-Meteo, reverse-geocodes the coordinates
 * via Nominatim, calculates the flood risk, stores everything in MySQL,
 * and returns a single enriched response object.
 */

const axios                  = require("axios");
const { saveWeather, getWeatherHistory } = require("../repositories/weatherRepository");
const { reverseGeocode }     = require("./geocodingService");
const { calculateFloodRisk } = require("../utils/floodRiskCalculator");
const { parsePagination, paginationMeta } = require("../utils/helper");
const logger                 = require("../config/logger");

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast";
const OPEN_METEO_PARAMS = [
    "temperature_2m",
    "relative_humidity_2m",
    "rain",
    "wind_speed_10m",
    "pressure_msl",
].join(",");

/**
 * Fetches current weather for the given coordinates, stores it, and
 * returns the full weather + flood-risk payload.
 *
 * @param {string|number} lat
 * @param {string|number} lon
 * @returns {Promise<object>}
 */
const getWeather = async (lat, lon) => {
    // 1. Call Open-Meteo
    let meteoResponse;
    try {
        meteoResponse = await axios.get(OPEN_METEO_URL, {
            params: {
                latitude:  lat,
                longitude: lon,
                current:   OPEN_METEO_PARAMS,
            },
            timeout: 10000,
        });
    } catch (err) {
        logger.error("Open-Meteo request failed.", { lat, lon, message: err.message });
        const error = new Error("Weather service unavailable. Please try again later.");
        error.statusCode = 503;
        throw error;
    }

    const current = meteoResponse.data?.current;
    if (!current) {
        const error = new Error("Unexpected response from weather provider.");
        error.statusCode = 502;
        throw error;
    }

    // 2. Reverse-geocode (never throws — falls back to "Unknown")
    const locationData = await reverseGeocode(lat, lon);

    // 3. Assemble the weather object
    const weather = {
        location:    locationData.location,
        state:       locationData.state,
        country:     locationData.country,
        latitude:    parseFloat(lat),
        longitude:   parseFloat(lon),
        temperature: current.temperature_2m,
        humidity:    current.relative_humidity_2m,
        rainfall:    current.rain,
        windSpeed:   current.wind_speed_10m,
        pressure:    current.pressure_msl,
        timestamp:   current.time,
    };

    // 4. Calculate flood risk from current readings
    const floodRisk = calculateFloodRisk(weather);

    // 5. Persist to MySQL (location upsert + WeatherData row)
    await saveWeather(weather);

    logger.info("Weather fetched and stored.", {
        location: weather.location,
        riskLevel: floodRisk.level,
    });

    // 6. Return enriched payload
    return {
        location:    weather.location,
        state:       weather.state,
        country:     weather.country,
        latitude:    weather.latitude,
        longitude:   weather.longitude,
        temperature: weather.temperature,
        humidity:    weather.humidity,
        rainfall:    weather.rainfall,
        windSpeed:   weather.windSpeed,
        pressure:    weather.pressure,
        timestamp:   weather.timestamp,
        floodRisk: {
            level:   floodRisk.level,
            score:   floodRisk.score,
            reasons: floodRisk.reasons,
        },
    };
};

/**
 * Returns paginated weather history, optionally filtered by locationId.
 *
 * @param {object} query  - req.query (page, limit, locationId)
 * @returns {Promise<{ records: object[], pagination: object }>}
 */
const getHistory = async (query) => {
    const { page, limit, skip } = parsePagination(query);
    const locationId = query.locationId ? parseInt(query.locationId, 10) : undefined;

    const { records, total } = await getWeatherHistory({
        locationId,
        skip,
        take: limit,
    });

    return {
        records,
        pagination: paginationMeta(total, page, limit),
    };
};

module.exports = { getWeather, getHistory };
