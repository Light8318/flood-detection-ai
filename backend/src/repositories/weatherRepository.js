/**
 * Weather Repository.
 * All Prisma operations for weather data and location management.
 */

const prisma = require("../config/prisma");

/**
 * Upserts the location row for the given coordinates and persists one
 * WeatherData record. Both writes run inside a transaction so the DB
 * is never left with a location but no data row (or vice-versa).
 *
 * @param {object} weather
 * @param {string} weather.location
 * @param {string} weather.state
 * @param {string} weather.country
 * @param {number} weather.latitude
 * @param {number} weather.longitude
 * @param {number} weather.temperature
 * @param {number} weather.humidity
 * @param {number} weather.rainfall
 * @param {number} weather.windSpeed
 * @param {number|null} weather.pressure
 * @param {string} weather.timestamp  — ISO string from Open-Meteo
 * @returns {Promise<object>} the created WeatherData row
 */
// Tolerance in degrees for matching an existing location (~11 m at the equator)
const COORD_DELTA = 0.0001;

const saveWeather = async (weather) => {
    return prisma.$transaction(async (tx) => {
        // Match an existing location within a small coordinate tolerance to avoid
        // IEEE 754 floating-point equality mismatches across different callers.
        let location = await tx.location.findFirst({
            where: {
                latitude:  { gte: weather.latitude  - COORD_DELTA, lte: weather.latitude  + COORD_DELTA },
                longitude: { gte: weather.longitude - COORD_DELTA, lte: weather.longitude + COORD_DELTA },
            },
        });

        if (!location) {
            location = await tx.location.create({
                data: {
                    name:      weather.location,
                    latitude:  weather.latitude,
                    longitude: weather.longitude,
                    state:     weather.state,
                    country:   weather.country,
                },
            });
        } else if (location.name === "Unknown" && weather.location !== "Unknown") {
            // Improve an existing record that had no name on first save
            location = await tx.location.update({
                where: { id: location.id },
                data: {
                    name:    weather.location,
                    state:   weather.state,
                    country: weather.country,
                },
            });
        }

        return tx.weatherData.create({
            data: {
                temperature: weather.temperature,
                humidity:    weather.humidity,
                rainfall:    weather.rainfall,
                windSpeed:   weather.windSpeed,
                pressure:    weather.pressure,
                timestamp:   new Date(weather.timestamp),
                locationId:  location.id,
            },
            include: {
                location: true,
            },
        });
    });
};

/**
 * Returns paginated weather history for a given location,
 * ordered newest-first.
 *
 * @param {object} params
 * @param {number} params.locationId
 * @param {number} params.skip
 * @param {number} params.take
 * @returns {Promise<{ records: object[], total: number }>}
 */
const getWeatherHistory = async ({ locationId, skip, take }) => {
    const where = locationId ? { locationId } : {};

    const [records, total] = await Promise.all([
        prisma.weatherData.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: { location: true },
        }),
        prisma.weatherData.count({ where }),
    ]);

    return { records, total };
};

/**
 * Returns a single Location row by id.
 * @param {number} id
 */
const findLocationById = async (id) => {
    return prisma.location.findUnique({ where: { id } });
};

/**
 * Returns all locations (used for admin / map views).
 */
const findAllLocations = async () => {
    return prisma.location.findMany({ orderBy: { name: "asc" } });
};

module.exports = {
    saveWeather,
    getWeatherHistory,
    findLocationById,
    findAllLocations,
};
