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
const axios  = require("axios");
const env    = require("../config/env");
const logger = require("../config/logger");
const { FLOOD_SEVERITY, RESCUE_PRIORITY } = require("../utils/constants");

// ── Helpers ──────────────────────────────────────────────────────────────────

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Builds the Gemini REST endpoint URL for the configured model.
 * @returns {string}
 */
const geminiUrl = () =>
    `${GEMINI_BASE}/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

/**
 * Posts a request to the Gemini API and returns the raw text from the
 * first candidate. Throws on HTTP or network errors.
 *
 * @param {object[]} parts  — Gemini content parts array
 * @returns {Promise<string>}
 */
const callGemini = async (parts) => {
    const body = {
        contents: [{ parts }],
        generationConfig: {
            temperature:     0.2,
            maxOutputTokens: 1024,
        },
    };

    const response = await axios.post(geminiUrl(), body, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
    });

    return response.data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
};

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
    if (!env.GEMINI_API_KEY) {
        logger.warn("GEMINI_API_KEY not set — skipping weather AI analysis.");
        return { aiAnalysis: null, recommendation: null };
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
        const rawText = await callGemini([{ text: prompt }]);
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
        logger.error("Gemini weather analysis failed.", { message: err.message });
        return { aiAnalysis: null, recommendation: null };
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

    if (!env.GEMINI_API_KEY) {
        logger.warn("GEMINI_API_KEY not set — skipping image AI analysis.");
        return NULL_RESULT;
    }

    // Read and base64-encode the image
    let imageBase64;
    let mimeType;
    try {
        const buffer   = fs.readFileSync(imagePath);
        imageBase64    = buffer.toString("base64");
        const ext      = path.extname(imagePath).toLowerCase().replace(".", "");
        const mimeMap  = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp" };
        mimeType       = mimeMap[ext] || "image/jpeg";
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
        const rawText = await callGemini([
            { text: prompt },
            {
                inlineData: {
                    mimeType,
                    data: imageBase64,
                },
            },
        ]);

        const parsed = extractJson(rawText);

        if (!parsed) {
            logger.warn("Gemini image analysis: unexpected response format.", { rawText });
            return { ...NULL_RESULT, imageAnalysis: rawText.trim() || null };
        }

        // Validate and sanitise enum fields — fall back to null if Gemini
        // returns a value outside the allowed set
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
        logger.error("Gemini image analysis failed.", { message: err.message });
        return NULL_RESULT;
    }
};

module.exports = { analyzeFloodRisk, analyzeFloodImage };
