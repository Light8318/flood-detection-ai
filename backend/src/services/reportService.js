/**
 * Report Service.
 * Business logic for user flood reports lifecycle.
 */

const path = require("path");
const fs   = require("fs");
const env  = require("../config/env");
const {
    createReport,
    findAllReports,
    findReportById,
    updateReport,
    deleteReport,
} = require("../repositories/reportRepository");
const { parsePagination, paginationMeta, stripUndefined } = require("../utils/helper");
const { getWeather } = require("./weatherService");
const { calculateFloodRisk } = require("../utils/floodRiskCalculator");
const { analyzeFloodRisk, analyzeFloodImage } = require("./geminiService");
const { createPrediction } = require("../repositories/predictionRepository");
const { triggerFloodAlert } = require("./n8nService");
const logger = require("../config/logger");
const { ALERT_EVENTS } = require("../utils/constants");

/**
 * Creates a new flood report submitted by a user.
 * @param {object} body     - validated request body
 * @param {object} user     - authenticated user
 * @param {object|null} file - Multer file object (optional)
 */
const submitReport = async (body, user, file) => {
    const imageUrl = file ? `/uploads/${file.filename}` : null;

    // 1. Save report
    const report = await createReport({
        description: body.description.trim(),
        address:     body.address.trim(),
        latitude:    body.latitude  ? parseFloat(body.latitude)  : null,
        longitude:   body.longitude ? parseFloat(body.longitude) : null,
        imageUrl,
        userId:      user.id,
    });
    logger.info("Report saved");
    console.log("Report saved");

    // 2. Fetch current weather for the report coordinates (fallback to Delhi if coordinates are missing)
    const resolvedLat = report.latitude !== null ? report.latitude : 28.6139;
    const resolvedLon = report.longitude !== null ? report.longitude : 77.2090;

    const weatherPayload = await getWeather(resolvedLat, resolvedLon);
    logger.info("Weather fetched");
    console.log("Weather fetched");

    // 3. Calculate flood risk
    const risk = calculateFloodRisk({
        rainfall:  weatherPayload.rainfall,
        humidity:  weatherPayload.humidity,
        windSpeed: weatherPayload.windSpeed,
        pressure:  weatherPayload.pressure,
    });

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

    // 4. Analyze the uploaded image with Gemini (and narrative weather analysis)
    const imagePath = file ? path.join(env.UPLOAD_DIR, file.filename) : null;
    
    const [weatherAI, imageAI] = await Promise.all([
        analyzeFloodRisk(weatherContext),
        file ? analyzeFloodImage(imagePath, {
            location:  weatherPayload.location,
            riskLevel: risk.level,
            rainfall:  weatherPayload.rainfall,
            humidity:  weatherPayload.humidity,
        }) : Promise.resolve({
            imageAnalysis:  null,
            floodSeverity:  null,
            confidence:     null,
            rescuePriority: null,
        }),
    ]);

    logger.info("Gemini analysis completed");
    console.log("Gemini analysis completed");

    // 5. Combine weather analysis and image analysis
    // 6. Determine emergency level (LOW, MEDIUM, HIGH, CRITICAL)
    let emergencyLevel = "LOW";
    const isCritical = (imageAI.rescuePriority === "CRITICAL" || imageAI.floodSeverity === "EXTREME");
    const isHigh = (risk.level === "HIGH" || imageAI.rescuePriority === "HIGH" || imageAI.floodSeverity === "SEVERE");
    const isMedium = (risk.level === "MEDIUM" || imageAI.rescuePriority === "MEDIUM" || imageAI.floodSeverity === "MODERATE");

    if (isCritical) {
        emergencyLevel = "CRITICAL";
    } else if (isHigh) {
        emergencyLevel = "HIGH";
    } else if (isMedium) {
        emergencyLevel = "MEDIUM";
    } else {
        emergencyLevel = "LOW";
    }

    // 7. Save the prediction in the database and update report severity
    const updatedReport = await updateReport(report.id, { severity: emergencyLevel });

    const predictionData = {
        riskLevel:      risk.level,
        riskScore:      risk.score,
        reasons:        risk.reasons,
        aiAnalysis:     weatherAI.aiAnalysis,
        recommendation: weatherAI.recommendation,
        imageAnalysis:  imageAI.imageAnalysis,
        floodSeverity:  imageAI.floodSeverity,
        confidence:     imageAI.confidence,
        rescuePriority: imageAI.rescuePriority,
        temperature:    weatherPayload.temperature,
        humidity:       weatherPayload.humidity,
        rainfall:       weatherPayload.rainfall,
        windSpeed:      weatherPayload.windSpeed,
        pressure:       weatherPayload.pressure,
        locationName:   weatherPayload.location,
        latitude:       resolvedLat,
        longitude:      resolvedLon,
        userId:         user.id,
        reportId:       report.id,
    };

    const prediction = await createPrediction(predictionData);

    logger.info("Prediction stored");
    console.log("Prediction stored");

    // 8. If severity is HIGH or CRITICAL, trigger the n8n webhook
    if (emergencyLevel === "HIGH" || emergencyLevel === "CRITICAL") {
        const eventName = emergencyLevel === "CRITICAL"
            ? ALERT_EVENTS.FLOOD_CRITICAL_RESCUE
            : ALERT_EVENTS.FLOOD_HIGH_RISK;

        const payload = {
            event: eventName,
            user: {
                id:    user.id,
                name:  user.name,
                email: user.email,
                role:  user.role,
            },
            location: {
                name:      prediction.locationName,
                latitude:  prediction.latitude,
                longitude: prediction.longitude,
                state:     weatherPayload.state || null,
                country:   weatherPayload.country || null,
            },
            weather: {
                temperature: prediction.temperature,
                humidity:    prediction.humidity,
                rainfall:    prediction.rainfall,
                windSpeed:   prediction.windSpeed,
                pressure:    prediction.pressure,
            },
            prediction: {
                id:             prediction.id,
                riskLevel:      prediction.riskLevel,
                riskScore:      prediction.riskScore,
                reasons:        prediction.reasons,
                aiAnalysis:     prediction.aiAnalysis     ?? null,
                recommendation: prediction.recommendation ?? null,
                imageAnalysis:  prediction.imageAnalysis  ?? null,
                floodSeverity:  prediction.floodSeverity  ?? null,
                confidence:     prediction.confidence     ?? null,
                rescuePriority: prediction.rescuePriority ?? null,
                reportId:       prediction.reportId       ?? null,
            },
            timestamp: prediction.createdAt instanceof Date
                ? prediction.createdAt.toISOString()
                : new Date().toISOString(),
        };

        // Fire-and-forget webhook trigger
        triggerFloodAlert(payload).catch((err) => {
            logger.error("n8n webhook dispatch failed", { message: err.message });
        });

        logger.info("n8n triggered");
        console.log("n8n triggered");
    }

    // 9. Return the report together with prediction data
    return {
        ...updatedReport,
        prediction,
    };
};

/**
 * Returns paginated reports.
 * Regular users only see their own; admins see all with optional status filter.
 */
const listReports = async (query, userId, isAdmin) => {
    const { page, limit, skip } = parsePagination(query);

    const { reports, total } = await findAllReports({
        skip,
        take:   limit,
        status: query.status || undefined,
        userId: isAdmin ? undefined : userId,
        sortByPriority: isAdmin,
    });

    return {
        reports,
        pagination: paginationMeta(total, page, limit),
    };
};

/**
 * Returns a single report.
 * Users can only see their own; admins see all.
 */
const getReport = async (id, userId, isAdmin) => {
    const report = await findReportById(id);

    if (!report) {
        const err = new Error("Report not found.");
        err.statusCode = 404;
        throw err;
    }

    if (!isAdmin && report.userId !== userId) {
        const err = new Error("Access denied.");
        err.statusCode = 403;
        throw err;
    }

    return report;
};

/**
 * Admin-only: updates report status and/or severity.
 */
const updateReportStatus = async (id, data) => {
    const report = await findReportById(id);
    if (!report) {
        const err = new Error("Report not found.");
        err.statusCode = 404;
        throw err;
    }

    return updateReport(id, stripUndefined({
        status:   data.status,
        severity: data.severity,
        notes:    data.notes,
    }));
};

/**
 * Deletes a report and its associated image file (if any).
 * Users can only delete their own; admins delete any.
 */
const removeReport = async (id, userId, isAdmin) => {
    const report = await findReportById(id);

    if (!report) {
        const err = new Error("Report not found.");
        err.statusCode = 404;
        throw err;
    }

    if (!isAdmin && report.userId !== userId) {
        const err = new Error("Access denied.");
        err.statusCode = 403;
        throw err;
    }

    // Remove uploaded image from disk.
    // report.imageUrl is stored as "/uploads/filename.jpg"; strip the leading
    // slash before joining so path.join doesn't treat it as an absolute path.
    if (report.imageUrl) {
        const filename = path.basename(report.imageUrl);
        const filePath = path.join(env.UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    return deleteReport(id);
};

/**
 * Saves administrative reply to report.
 */
const respondToReport = async (id, data, adminName) => {
    const report = await findReportById(id);
    if (!report) {
        const err = new Error("Report not found.");
        err.statusCode = 404;
        throw err;
    }

    return updateReport(id, {
        adminResponse: data.adminResponse,
        respondedBy:   adminName,
        respondedAt:   new Date(),
    });
};

module.exports = {
    submitReport,
    listReports,
    getReport,
    updateReportStatus,
    respondToReport,
    removeReport,
};
