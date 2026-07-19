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
const { analyzeFloodRisk, analyzeFloodImage, generateEmergencyCommunication } = require("./geminiService");
const { createPrediction } = require("../repositories/predictionRepository");
const { triggerFloodAlert, triggerReportCreated } = require("./n8nService");
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
    // 6. Determine emergency level (LOW, MEDIUM, HIGH, CRITICAL, or UNAVAILABLE)
    let emergencyLevel = "LOW";
    let aiFailed = false;
    let aiReason = "";

    if (weatherAI.error || imageAI.error) {
        aiFailed = true;
        const errMsg = weatherAI.error || imageAI.error;
        const isQuota = errMsg.includes("429") || 
                        errMsg.toLowerCase().includes("quota") || 
                        errMsg.toLowerCase().includes("limit") ||
                        errMsg.toLowerCase().includes("exhausted");
        aiReason = isQuota ? "Gemini quota exceeded" : `Gemini API Error: ${errMsg}`;
    }

    const isCritical = (imageAI.rescuePriority === "CRITICAL" || imageAI.floodSeverity === "EXTREME");
    const isHigh = (risk.level === "HIGH" || imageAI.rescuePriority === "HIGH" || imageAI.floodSeverity === "SEVERE");
    const isMedium = (risk.level === "MEDIUM" || imageAI.rescuePriority === "MEDIUM" || imageAI.floodSeverity === "MODERATE");

    if (aiFailed) {
        emergencyLevel = "UNAVAILABLE";
    } else if (isCritical) {
        emergencyLevel = "CRITICAL";
    } else if (isHigh) {
        emergencyLevel = "HIGH";
    } else if (isMedium) {
        emergencyLevel = "MEDIUM";
    } else {
        emergencyLevel = "LOW";
    }

    // 7. Save the prediction in the database and update report severity
    logger.info("[DEBUG] Attempting to update report severity in DB via updateReport...");
    console.log("[DEBUG] Attempting to update report severity in DB via updateReport...");
    let updatedReport;
    try {
        updatedReport = await updateReport(report.id, { severity: emergencyLevel });
        logger.info("[DEBUG] Report severity updated successfully", { id: updatedReport.id, severity: updatedReport.severity });
        console.log("[DEBUG] Report severity updated successfully. ID:", updatedReport.id, "Severity:", updatedReport.severity);
    } catch (err) {
        logger.error("[DEBUG] Failed to update report severity", { message: err.message, stack: err.stack });
        console.error("[DEBUG] Failed to update report severity:", err);
        throw err;
    }

    // Call generateEmergencyCommunication first
    let communication = null;
    if (!aiFailed) {
        logger.info("[DEBUG] Attempting to generate emergency communication via Gemini...");
        console.log("[DEBUG] Attempting to generate emergency communication via Gemini...");
        try {
            communication = await generateEmergencyCommunication({
                report: {
                    id:          report.id,
                    description: report.description,
                    address:     report.address,
                    latitude:    report.latitude,
                    longitude:   report.longitude,
                    severity:    emergencyLevel,
                    status:      report.status,
                    createdAt:   report.createdAt,
                    phone:       body.phone || user.phone || null
                },
                aiAnalysis:     weatherAI.aiAnalysis,
                weatherRisk:    risk.level,
                rescuePriority: imageAI.rescuePriority
            });
            logger.info("[DEBUG] Emergency communication generated successfully");
            console.log("[DEBUG] Emergency communication generated successfully");
        } catch (err) {
            logger.error("[DEBUG] Failed to generate emergency communication", { message: err.message, stack: err.stack });
            console.error("[DEBUG] Failed to generate emergency communication:", err);
            // Do not throw to allow PDF generation to proceed
        }
    }

    const aiSummary = aiFailed
        ? `AI Severity: UNAVAILABLE\nReason: ${aiReason}`
        : (communication ? communication.summary : (weatherAI.aiAnalysis || "N/A"));

    const safetyInstructions = aiFailed
        ? "Stay indoors, avoid low-lying roads and waterlogged zones, and keep emergency contact numbers ready."
        : (communication ? communication.safetyInstructions : (weatherAI.recommendation || "N/A"));

    const emailSubject = aiFailed
        ? "Flood Report Acknowledgement"
        : (communication ? communication.subject : "Flood Report Acknowledgement");

    const emailHtml = aiFailed
        ? `<p>Your flood report has been successfully registered. However, the AI analysis is currently unavailable: ${aiReason}</p>`
        : (communication ? communication.html : "<p>Report received.</p>");

    // Generate PDF report using pdf-lib
    let pdfBuffer = null;
    let pdfGenerated = false;
    logger.info("[DEBUG] Attempting to generate PDF report via pdf-lib...");
    console.log("[DEBUG] Attempting to generate PDF report via pdf-lib...");
    try {
        const { generateIncidentReportPDF } = require("./pdfService");
        pdfBuffer = await generateIncidentReportPDF({
            id: updatedReport.id,
            reporter: user.name,
            email: user.email,
            phone: body.phone || user.phone || "N/A",
            location: updatedReport.address,
            latitude: updatedReport.latitude,
            longitude: updatedReport.longitude,
            description: updatedReport.description,
            severity: updatedReport.severity,
            weatherRisk: risk.level,
            rescuePriority: imageAI.rescuePriority || "N/A",
            aiAnalysis: aiFailed ? `AI Severity: UNAVAILABLE\nReason: ${aiReason}` : (imageAI.imageAnalysis || weatherAI.aiAnalysis || "N/A"),
            executiveSummary: aiSummary,
            safetyInstructions: safetyInstructions,
            status: updatedReport.status,
            createdAt: updatedReport.createdAt
        });
        pdfGenerated = true;
        logger.info("[DEBUG] PDF report generated successfully", { size: pdfBuffer ? pdfBuffer.length : 0 });
        console.log("[DEBUG] PDF report generated successfully. Size:", pdfBuffer ? pdfBuffer.length : 0);
    } catch (err) {
        logger.error("[DEBUG] Failed to generate PDF report", { message: err.message, stack: err.stack });
        console.error("[DEBUG] Failed to generate PDF report:", err);
    }

    // Send email using Resend SDK is commented out to let n8n handle all downstream email delivery
    let emailSent = false;
    /*
    try {
        const { sendEmergencyEmail } = require("./emailService");
        emailSent = await sendEmergencyEmail({
            to: user.email,
            subject: emailSubject,
            html: emailHtml,
            pdfBuffer: pdfBuffer
        });
    } catch (err) {
        logger.error("Failed to send email via Resend SDK", err);
    }
    */

    // Save prediction in database
    const predictionData = {
        riskLevel:      risk.level,
        riskScore:      risk.score,
        reasons:        aiFailed ? {
            factors:            risk.reasons,
            aiStatus:           "FAILED",
            aiReason:           aiReason,
            severity:           null
        } : {
            factors:            risk.reasons,
            subject:            emailSubject,
            html:               emailHtml,
            summary:            aiSummary,
            safetyInstructions: safetyInstructions
        },
        aiAnalysis:     aiSummary,
        recommendation: safetyInstructions,
        imageAnalysis:  aiFailed ? `AI Severity: UNAVAILABLE\nReason: ${aiReason}` : imageAI.imageAnalysis,
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

    logger.info("[DEBUG] Attempting to save prediction in DB via createPrediction...");
    console.log("[DEBUG] Attempting to save prediction in DB via createPrediction...");
    let prediction;
    try {
        prediction = await createPrediction(predictionData);
        logger.info("Prediction stored", { id: prediction.id });
        console.log("Prediction stored. ID:", prediction.id);
    } catch (err) {
        logger.error("[DEBUG] Failed to save prediction in DB", { message: err.message, stack: err.stack });
        console.error("[DEBUG] Failed to save prediction in DB:", err);
        throw err;
    }

    // Trigger n8n after all previous steps succeed (we consider report creation pipeline success)
    logger.info("[DEBUG] Attempting to trigger n8n webhook via triggerReportCreated...");
    console.log("[DEBUG] Attempting to trigger n8n webhook via triggerReportCreated...");
    try {
        await triggerReportCreated({
            reportId: updatedReport.id,
            incidentId: updatedReport.id,
            reporterName: user.name,
            email: user.email,
            phone: body.phone || user.phone || "N/A",
            location: updatedReport.address,
            latitude: updatedReport.latitude,
            longitude: updatedReport.longitude,
            severity: updatedReport.severity,
            weatherRisk: risk.level,
            description: updatedReport.description,
            aiSummary: aiSummary,
            subject: emailSubject,
            html: emailHtml,
            pdfUrl: `https://flood-detection-ai.onrender.com/api/reports/${updatedReport.id}/pdf`
        });
        logger.info("[DEBUG] triggerReportCreated successfully executed");
        console.log("[DEBUG] triggerReportCreated successfully executed");
    } catch (err) {
        logger.error("Failed to trigger n8n webhook", err);
        console.error("Failed to trigger n8n webhook:", err);
    }

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

const getReportDataForPDF = async (id) => {
    const report = await getReport(id, null, true);
    if (!report) return null;
    
    const prediction = report.predictions && report.predictions.length > 0 ? report.predictions[0] : {};
    
    let summary = prediction.aiAnalysis;
    let safety = prediction.recommendation;
    if (prediction.reasons && typeof prediction.reasons === "object" && !Array.isArray(prediction.reasons)) {
        if (prediction.reasons.summary) summary = prediction.reasons.summary;
        if (prediction.reasons.safetyInstructions) safety = prediction.reasons.safetyInstructions;
    }
    
    return {
        id: report.id,
        reporter: report.user ? report.user.name : "N/A",
        email: report.user ? report.user.email : "N/A",
        phone: "N/A",
        location: report.address,
        latitude: report.latitude,
        longitude: report.longitude,
        description: report.description,
        severity: report.severity,
        weatherRisk: prediction.riskLevel || "N/A",
        rescuePriority: prediction.rescuePriority || "N/A",
        aiAnalysis: prediction.imageAnalysis || prediction.aiAnalysis || "N/A",
        executiveSummary: summary || "N/A",
        safetyInstructions: safety || "N/A",
        status: report.status,
        createdAt: report.createdAt
    };
};

module.exports = {
    submitReport,
    listReports,
    getReport,
    updateReportStatus,
    respondToReport,
    removeReport,
    getReportDataForPDF
};
