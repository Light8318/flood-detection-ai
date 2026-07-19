/**
 * Gemini AI Service.
 *
 * Exposes two independent functions:
 *
 *  1. analyzeFloodRisk(context)
 *     — weather-conditions analysis → aiAnalysis + recommendation
 *
 *  2. analyzeFloodImage(imagePath, weatherContext)
 *     — multimodal vision analysis of an uploaded flood photograph
 *     — returns: imageAnalysis, floodSeverity, confidence, rescuePriority
 *
 * Both functions degrade gracefully when GEMINI_API_KEY is absent or the
 * API call fails — they return null fields so the prediction pipeline
 * always completes.
 */

const fs     = require("fs");
const path   = require("path");
const env    = require("../config/env");
const logger = require("../config/logger");
const { GoogleGenAI } = require("@google/genai");
const { FLOOD_SEVERITY, RESCUE_PRIORITY } = require("../utils/constants");

// Initialize Google Gemini SDK
let ai = null;
if (env.GEMINI_API_KEY) {
    try {
        ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        logger.info("Gemini API Key Loaded");
        console.log("Gemini API Key Loaded");
    } catch (err) {
        logger.error("Failed to initialize Google Generative AI SDK", { message: err.message });
    }
} else {
    logger.warn("GEMINI_API_KEY not set — Gemini SDK not initialized.");
}

/**
 * Attempts to extract the first JSON object from a raw Gemini text response.
 * Returns null when no valid JSON block is found.
 *
 * @param {string} rawText
 * @returns {object|null}
 */
const extractJson = (rawText) => {
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
        return JSON.parse(match[0]);
    } catch {
        return null;
    }
};

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Analyzes weather conditions and returns a narrative flood risk assessment.
 *
 * @param {object}   context
 * @param {string}   context.location
 * @param {number}   context.temperature
 * @param {number}   context.humidity
 * @param {number}   context.rainfall
 * @param {number}   context.windSpeed
 * @param {number}   context.pressure
 * @param {string}   context.riskLevel   — rule-based level (LOW/MEDIUM/HIGH)
 * @param {number}   context.riskScore
 * @param {string[]} context.reasons
 *
 * @returns {Promise<{
 *   aiAnalysis:     string|null,
 *   recommendation: string|null
 * }>}
 */
const analyzeFloodRisk = async (context) => {
    if (!ai) {
        logger.warn("GEMINI_API_KEY not set — skipping weather AI analysis.");
        return { aiAnalysis: null, recommendation: null, error: "GEMINI_API_KEY not set" };
    }

    const prompt = `
You are a flood risk analyst AI embedded in an emergency disaster response system.

Location: ${context.location}
Current weather conditions:
  - Temperature     : ${context.temperature} °C
  - Humidity        : ${context.humidity} %
  - Rainfall        : ${context.rainfall} mm
  - Wind Speed      : ${context.windSpeed} km/h
  - Pressure        : ${context.pressure} hPa

Rule-based risk assessment: ${context.riskLevel} (score ${context.riskScore}/110)
Contributing factors     : ${context.reasons.join(", ") || "none"}

Task:
1. Write a concise flood risk analysis (2–3 sentences) based on the weather data above.
2. Write 2–3 actionable bullet-point recommendations for emergency authorities.

Respond ONLY with a valid JSON object — no markdown, no extra text:
{
  "aiAnalysis": "<analysis>",
  "recommendation": "<bullet points as a single string>"
}
`.trim();

    try {
        logger.info("Sending request to Gemini");
        console.log("Sending request to Gemini");
        
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
        });
        const rawText = response.text || "";

        logger.info("Gemini response received");
        console.log("Gemini response received");

        const parsed  = extractJson(rawText);

        if (!parsed) {
            logger.warn("Gemini weather analysis: unexpected response format.", { rawText });
            return { aiAnalysis: rawText.trim() || null, recommendation: null };
        }

        return {
            aiAnalysis:     parsed.aiAnalysis     || null,
            recommendation: parsed.recommendation || null,
        };
    } catch (err) {
        logger.error("Gemini API Error", { message: err.message });
        console.error("Gemini API Error:", err.message);
        return { aiAnalysis: null, recommendation: null, error: err.message };
    }
};

/**
 * Analyzes an uploaded flood image using Gemini's multimodal vision capability.
 * The image is read from disk, base64-encoded, and sent inline.
 *
 * Returns all four structured fields required by the FloodPrediction model:
 *   - imageAnalysis   : narrative description of what is visible
 *   - floodSeverity   : one of NONE | MINOR | MODERATE | SEVERE | EXTREME
 *   - confidence      : 0.0 – 1.0 (Gemini's self-reported confidence)
 *   - rescuePriority  : one of LOW | MEDIUM | HIGH | CRITICAL
 *
 * Degrades gracefully when the image cannot be read or the API fails.
 *
 * @param {string} imagePath            — absolute path to the uploaded file
 * @param {object} weatherContext       — weather snapshot for richer prompt context
 * @param {string} weatherContext.location
 * @param {string} weatherContext.riskLevel
 * @param {number} weatherContext.rainfall
 * @param {number} weatherContext.humidity
 *
 * @returns {Promise<{
 *   imageAnalysis:  string|null,
 *   floodSeverity:  string|null,
 *   confidence:     number|null,
 *   rescuePriority: string|null
 * }>}
 */
const analyzeFloodImage = async (imagePath, weatherContext) => {
    const NULL_RESULT = {
        imageAnalysis:  null,
        floodSeverity:  null,
        confidence:     null,
        rescuePriority: null,
    };

    if (!ai) {
        logger.warn("GEMINI_API_KEY not set — skipping image AI analysis.");
        return { ...NULL_RESULT, error: "GEMINI_API_KEY not set" };
    }

    let mimeType;
    try {
        const ext = path.extname(imagePath).toLowerCase().replace(".", "");
        const mimeMap = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
        mimeType = mimeMap[ext] || "image/jpeg";
    } catch (err) {
        logger.error("Failed to read image for Gemini analysis.", { imagePath, message: err.message });
        return NULL_RESULT;
    }

    const validSeverities = Object.values(FLOOD_SEVERITY).join(" | ");
    const validPriorities = Object.values(RESCUE_PRIORITY).join(" | ");

    const prompt = `
You are an expert flood damage assessor AI within an emergency disaster response system.

The image attached shows a scene from a flood-affected area.
Supporting weather data for context:
  - Location    : ${weatherContext.location}
  - Risk Level  : ${weatherContext.riskLevel}
  - Rainfall    : ${weatherContext.rainfall} mm
  - Humidity    : ${weatherContext.humidity} %

Analyze the image carefully and respond ONLY with a valid JSON object — no markdown, no extra text:
{
  "imageAnalysis":  "<2–3 sentence description of the flood situation visible in the image>",
  "floodSeverity":  "<one of: ${validSeverities}>",
  "confidence":     <0.0 to 1.0 — your confidence in the severity assessment>,
  "rescuePriority": "<one of: ${validPriorities} — urgency for search-and-rescue deployment>"
}

Rules:
- floodSeverity must be exactly one of: ${validSeverities}
- rescuePriority must be exactly one of: ${validPriorities}
- confidence must be a number between 0.0 and 1.0
- Base your assessment solely on visual evidence in the image plus the weather context.
`.trim();

    try {
        const imagePart = {
            inlineData: {
                data: fs.readFileSync(imagePath).toString("base64"),
                mimeType
            }
        };

        logger.info("Sending request to Gemini");
        console.log("Sending request to Gemini");

        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: [prompt, imagePart]
        });
        const rawText = response.text || "";

        logger.info("Gemini response received");
        console.log("Gemini response received");

        const parsed = extractJson(rawText);

        if (!parsed) {
            logger.warn("Gemini image analysis: unexpected response format.", { rawText });
            return { ...NULL_RESULT, imageAnalysis: rawText.trim() || null };
        }

        const floodSeverity  = Object.values(FLOOD_SEVERITY).includes(parsed.floodSeverity)
            ? parsed.floodSeverity
            : null;

        const rescuePriority = Object.values(RESCUE_PRIORITY).includes(parsed.rescuePriority)
            ? parsed.rescuePriority
            : null;

        const confidence = typeof parsed.confidence === "number"
            ? Math.min(1, Math.max(0, parsed.confidence))
            : null;

        return {
            imageAnalysis:  parsed.imageAnalysis || null,
            floodSeverity,
            confidence,
            rescuePriority,
        };
    } catch (err) {
        logger.error("Gemini API Error", { message: err.message });
        console.error("Gemini API Error:", err.message);
        return { ...NULL_RESULT, error: err.message };
    }
};

/**
 * Generates email content, incident summary, and safety instructions via Gemini AI.
 * Falls back to a predefined template if Gemini is unavailable or returns bad content.
 *
 * @param {object} param0
 * @param {object} param0.report
 * @param {string} param0.aiAnalysis
 * @param {string} param0.weatherRisk
 * @param {string} param0.rescuePriority
 * @returns {Promise<{
 *   subject: string,
 *   html: string,
 *   summary: string,
 *   safetyInstructions: string
 * }>}
 */
const generateEmergencyCommunication = async ({ report, aiAnalysis, weatherRisk, rescuePriority }) => {
    if (!ai) {
        logger.warn("GEMINI_API_KEY not set — using fallback emergency communication.");
        return getFallbackCommunication({ report, aiAnalysis, weatherRisk, rescuePriority });
    }

    const reporterName = report.user?.name || report.reporter || "Citizen";
    const reporterEmail = report.user?.email || report.email || "";

    const prompt = `
You are an emergency response officer.
The flood has already been analyzed.
Do NOT analyze the flood again.
Use the supplied report information:
- Incident ID: ${report.id}
- Reporter: ${reporterName}
- Email: ${reporterEmail}
- Phone: ${report.phone || "N/A"}
- Location: ${report.address || report.location || "N/A"}
- Latitude: ${report.latitude || "N/A"}
- Longitude: ${report.longitude || "N/A"}
- Description: ${report.description}
- Severity: ${report.severity || "N/A"}
- Weather Risk: ${weatherRisk || "N/A"}
- Rescue Priority: ${rescuePriority || "N/A"}
- AI Analysis: ${aiAnalysis || "N/A"}
- Status: ${report.status || "N/A"}
- Created At: ${report.createdAt}

Generate:
1. Professional Email Subject
2. HTML Email Body (use professional, modern styling in inline CSS for the recipient citizen, including their name)
3. Executive Incident Summary (concise summary for emergency services)
4. Citizen Safety Instructions (step-by-step instructions for the citizen based on severity: ${report.severity})

Return ONLY valid JSON in the following format:
{
  "subject": "<subject>",
  "html": "<html>",
  "summary": "<summary>",
  "safetyInstructions": "<safetyInstructions>"
}
Return JSON only.
`.trim();

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
        });
        const rawText = response.text || "";
        const parsed = extractJson(rawText);

        if (!parsed || !parsed.subject || !parsed.html) {
            logger.warn("Gemini communication generation: invalid format, using fallback.", { rawText });
            return getFallbackCommunication({ report, aiAnalysis, weatherRisk, rescuePriority });
        }

        return {
            subject: parsed.subject,
            html: parsed.html,
            summary: parsed.summary || "",
            safetyInstructions: parsed.safetyInstructions || "",
        };
    } catch (err) {
        logger.error("Gemini communication generation failed: " + err.message);
        return getFallbackCommunication({ report, aiAnalysis, weatherRisk, rescuePriority });
    }
};

const getFallbackCommunication = ({ report, aiAnalysis, weatherRisk, rescuePriority }) => {
    const severity = report.severity || "UNKNOWN";
    const reporterName = report.user?.name || report.reporter || "Citizen";
    const address = report.address || report.location || "N/A";
    return {
        subject: `Flood Report #${report.id} Registered - FloodLine Notification`,
        html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                <h2 style="color: #1a365d;">FloodLine Notification</h2>
                <p>Hello ${reporterName},</p>
                <p>Your flood report has been successfully submitted and saved in our system.</p>
                <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Incident ID</td><td style="padding: 8px; border: 1px solid #ddd;">${report.id}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Location</td><td style="padding: 8px; border: 1px solid #ddd;">${address}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">Assessed Severity</td><td style="padding: 8px; border: 1px solid #ddd; color: #c53030; font-weight: bold;">${severity}</td></tr>
                </table>
                <p>Our emergency response team has been alerted and will coordinate rescue/relief actions as necessary.</p>
                <p>Best regards,<br>FloodLine Emergency Response Team</p>
            </div>
        `.trim(),
        summary: `Flood report #${report.id} successfully registered. System severity is ${severity}. Fallback email communication active.`,
        safetyInstructions: "Stay indoors, avoid low-lying roads and waterlogged zones, and keep emergency contact numbers ready."
    };
};

module.exports = { analyzeFloodRisk, analyzeFloodImage, generateEmergencyCommunication };
