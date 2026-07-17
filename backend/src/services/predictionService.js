/**
 * Prediction Service.
 *
 * Full pipeline:
 *   1. Resolve report (if reportId supplied) → derive coordinates
 *   2. Fetch weather (Open-Meteo + Nominatim + save WeatherData)
 *   3. Calculate rule-based flood risk score
 *   4. Gemini weather analysis   → aiAnalysis, recommendation
 *   5. Gemini image analysis     → imageAnalysis, floodSeverity, confidence, rescuePriority
 *      (only when an image path is provided)
 *   6. Persist FloodPrediction with all fields + User + optional Report
 *   7. Dispatch HIGH-risk n8n alert (fire-and-forget)
 *   8. Return the saved prediction record
 */

const path                = require("path");
const { getWeather }      = require("./weatherService");
const { calculateFloodRisk } = require("../utils/floodRiskCalculator");
const { analyzeFloodRisk, analyzeFloodImage } = require("./geminiService");
const { notifyIfHighRisk } = require("./notificationService");
const { findReportById }  = require("../repositories/reportRepository");
const {
    createPrediction,
    findAllPredictions,
    findPredictionById,
} = require("../repositories/predictionRepository");
const { parsePagination, paginationMeta } = require("../utils/helper");
const env    = require("../config/env");
const logger = require("../config/logger");

// ── Private helpers ───────────────────────────────────────────────────────────

/**
 * Validates that the report exists and belongs to the requesting user.
 * @param {number} reportId
 * @param {number} userId
 * @returns {Promise<object>} the report record
 */
const resolveReport = async (reportId, userId) => {
    const report = await findReportById(reportId);

    if (!report) {
        const err = new Error(`Report #${reportId} not found.`);
        err.statusCode = 404;
        throw err;
    }

    if (report.userId !== userId) {
        const err = new Error("You can only link predictions to your own reports.");
        err.statusCode = 403;
        throw err;
    }

    return report;
};

/**
 * Resolves the absolute disk path of an uploaded image given its
 * URL-relative path (e.g. "/uploads/filename.jpg").
 * Returns null when imageUrl is null/undefined.
 * @param {string|null} imageUrl
 * @returns {string|null}
 */
const resolveImagePath = (imageUrl) => {
    if (!imageUrl) return null;
    // imageUrl is stored as "/uploads/<filename>" — resolve from project root
    return path.join(process.cwd(), env.UPLOAD_DIR, path.basename(imageUrl));
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Runs the full flood prediction pipeline.
 *
 * @param {string|number|null} lat
 * @param {string|number|null} lon
 * @param {object}             user       — { id, name, email, role }
 * @param {number|null}        reportId   — optional: links prediction to a report
 * @param {string|null}        imageUrl   — optional: "/uploads/<filename>" path of uploaded image
 * @returns {Promise<object>}  saved FloodPrediction with all relations
 */
const predict = async (lat, lon, user, reportId, imageUrl) => {
    let resolvedLat  = lat ? parseFloat(lat) : null;
    let resolvedLon  = lon ? parseFloat(lon) : null;
    let linkedReport = null;

    // 1. Resolve report — validate ownership, optionally derive coordinates
    if (reportId) {
        linkedReport = await resolveReport(reportId, user.id);

        // Fall back to report coords when the caller omitted lat/lon
        if (!resolvedLat && linkedReport.latitude)  resolvedLat = linkedReport.latitude;
        if (!resolvedLon && linkedReport.longitude) resolvedLon = linkedReport.longitude;

        // If the report has an image and no explicit imageUrl was uploaded,
        // reuse the report's image for analysis
        if (!imageUrl && linkedReport.imageUrl) {
            imageUrl = linkedReport.imageUrl;
        }
    }

    if (!resolvedLat || !resolvedLon) {
        const err = new Error(
            "Latitude and longitude are required when no report coordinates are available."
        );
        err.statusCode = 422;
        throw err;
    }

    // 2. Fetch live weather (also saves WeatherData row)
    const weatherPayload = await getWeather(resolvedLat, resolvedLon);

    // 3. Rule-based risk score
    const risk = calculateFloodRisk({
        rainfall:  weatherPayload.rainfall,
        humidity:  weatherPayload.humidity,
        windSpeed: weatherPayload.windSpeed,
        pressure:  weatherPayload.pressure,
    });

    // Shared weather context passed to both Gemini calls
    const weatherContext = {
        location:    weatherPayload.location,
        riskLevel:   risk.level,
        riskScore:   risk.score,
        reasons:     risk.reasons,
        temperature: weatherPayload.temperature,
        humidity:    weatherPayload.humidity,
        rainfall:    weatherPayload.rainfall,
        windSpeed:   weatherPayload.windSpeed,
        pressure:    weatherPayload.pressure,
    };

    // 4. Gemini weather narrative analysis
    const weatherAI = await analyzeFloodRisk(weatherContext);

    // 5. Gemini image analysis (only when an image is available)
    const imagePath = resolveImagePath(imageUrl);
    const imageAI   = await analyzeFloodImage(imagePath, {
        location:  weatherPayload.location,
        riskLevel: risk.level,
        rainfall:  weatherPayload.rainfall,
        humidity:  weatherPayload.humidity,
    });

    // 6. Persist prediction
    const predictionData = {
        // Rule-based fields
        riskLevel: risk.level,
        riskScore: risk.score,
        reasons:   risk.reasons,

        // Gemini weather output
        aiAnalysis:     weatherAI.aiAnalysis,
        recommendation: weatherAI.recommendation,

        // Gemini image output
        imageAnalysis:  imageAI.imageAnalysis,
        floodSeverity:  imageAI.floodSeverity,
        confidence:     imageAI.confidence,
        rescuePriority: imageAI.rescuePriority,

        // Weather snapshot
        temperature: weatherPayload.temperature,
        humidity:    weatherPayload.humidity,
        rainfall:    weatherPayload.rainfall,
        windSpeed:   weatherPayload.windSpeed,
        pressure:    weatherPayload.pressure,

        locationName: weatherPayload.location,
        latitude:     resolvedLat,
        longitude:    resolvedLon,

        userId: user.id,

        ...(linkedReport ? { reportId: linkedReport.id } : {}),
    };

    const prediction = await createPrediction(predictionData);

    logger.info("Flood prediction created.", {
        id:            prediction.id,
        riskLevel:     prediction.riskLevel,
        floodSeverity: prediction.floodSeverity,
        rescuePriority: prediction.rescuePriority,
        location:      prediction.locationName,
        userId:        user.id,
        reportId:      prediction.reportId ?? null,
        hasImage:      !!imageUrl,
    });

    // 7. Fire-and-forget HIGH-risk n8n alert
    notifyIfHighRisk(prediction, user).catch(() => {});

    return prediction;
};

/**
 * Returns paginated prediction history.
 * @param {object}  query
 * @param {number}  userId
 * @param {boolean} isAdmin
 */
const getHistory = async (query, userId, isAdmin) => {
    const { page, limit, skip } = parsePagination(query);
    const reportId = query.reportId ? parseInt(query.reportId, 10) : undefined;

    const { predictions, total } = await findAllPredictions({
        skip,
        take:      limit,
        userId:    isAdmin ? undefined : userId,
        riskLevel: query.riskLevel || undefined,
        reportId:  reportId        || undefined,
    });

    return {
        predictions,
        pagination: paginationMeta(total, page, limit),
    };
};

/**
 * Returns a single prediction by id.
 * Users can only retrieve their own; admins see all.
 * @param {number}  id
 * @param {number}  userId
 * @param {boolean} isAdmin
 */
const getById = async (id, userId, isAdmin) => {
    const prediction = await findPredictionById(id);

    if (!prediction) {
        const err = new Error("Prediction not found.");
        err.statusCode = 404;
        throw err;
    }

    if (!isAdmin && prediction.userId !== userId) {
        const err = new Error("Access denied.");
        err.statusCode = 403;
        throw err;
    }

    return prediction;
};

module.exports = { predict, getHistory, getById };
