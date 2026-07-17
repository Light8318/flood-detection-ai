/**
 * Geocoding Service.
 * Reverse-geocodes lat/lon → human-readable location using
 * OpenStreetMap Nominatim. Failures are handled gracefully:
 * a structured "Unknown" fallback is returned so the weather
 * pipeline never crashes because of a geocoding outage.
 */

const axios  = require("axios");
const logger = require("../config/logger");

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS    = 8000;

/**
 * @param {string|number} lat
 * @param {string|number} lon
 * @returns {Promise<{ location: string, state: string, country: string }>}
 */
const reverseGeocode = async (lat, lon) => {
    try {
        const response = await axios.get(NOMINATIM_URL, {
            params: { lat, lon, format: "jsonv2" },
            headers: { "User-Agent": "FloodDetectionAI/1.0 (contact@flooddetection.ai)" },
            timeout: TIMEOUT_MS,
        });

        const address = response.data?.address ?? {};

        return {
            location:
                address.city          ||
                address.town          ||
                address.village       ||
                address.state_district ||
                address.county        ||
                "Unknown",
            state:   address.state   || "Unknown",
            country: address.country || "Unknown",
        };
    } catch (err) {
        // Log the failure but never let geocoding break the weather fetch
        logger.warn("Reverse geocoding failed — using Unknown fallback.", {
            lat,
            lon,
            message: err.message,
        });

        return { location: "Unknown", state: "Unknown", country: "Unknown" };
    }
};

module.exports = { reverseGeocode };
