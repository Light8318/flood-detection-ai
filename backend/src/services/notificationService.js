/**
 * Notification Service.
 *
 * Evaluates a completed FloodPrediction and decides whether an alert must be
 * dispatched to n8n. The trigger fires when ANY of the following is true:
 *
 *   1. riskLevel      is HIGH               (rule-based score ≥ 70/110)
 *   2. rescuePriority is CRITICAL            (Gemini image analysis)
 *   3. floodSeverity  is SEVERE or EXTREME   (Gemini image analysis)
 *
 * The webhook payload is structured into five named blocks so that n8n
 * workflow nodes can address individual fields without path-guessing:
 *
 *   event       — string identifier consumed by n8n trigger routing
 *   user        — who submitted the prediction
 *   location    — where
 *   weather     — the live conditions at the time of prediction
 *   prediction  — the full AI + rule-based assessment
 *   timestamp   — ISO-8601 string of when the prediction was created
 */

const { ALERT_EVENTS, ALERT_TRIGGER } = require("../utils/constants");
const { triggerFloodAlert }           = require("./n8nService");
const logger                          = require("../config/logger");

// ── Trigger evaluation ────────────────────────────────────────────────────────

/**
 * Returns true if the prediction meets at least one alert condition.
 * @param {object} prediction  — saved FloodPrediction record
 * @returns {boolean}
 */
const shouldAlert = (prediction) => {
    if (ALERT_TRIGGER.RISK_LEVELS.includes(prediction.riskLevel)) {
        return true;
    }
    if (prediction.rescuePriority &&
        ALERT_TRIGGER.RESCUE_PRIORITIES.includes(prediction.rescuePriority)) {
        return true;
    }
    if (prediction.floodSeverity &&
        ALERT_TRIGGER.FLOOD_SEVERITIES.includes(prediction.floodSeverity)) {
        return true;
    }
    return false;
};

/**
 * Picks the most descriptive event name for the n8n webhook based on what
 * triggered the alert. Priority: image evidence > rule-based score.
 * @param {object} prediction
 * @returns {string}
 */
const resolveEventName = (prediction) => {
    if (prediction.rescuePriority &&
        ALERT_TRIGGER.RESCUE_PRIORITIES.includes(prediction.rescuePriority)) {
        return ALERT_EVENTS.FLOOD_CRITICAL_RESCUE;
    }
    if (prediction.floodSeverity &&
        ALERT_TRIGGER.FLOOD_SEVERITIES.includes(prediction.floodSeverity)) {
        return ALERT_EVENTS.FLOOD_EXTREME_VISUAL;
    }
    return ALERT_EVENTS.FLOOD_HIGH_RISK;
};

// ── Payload builder ───────────────────────────────────────────────────────────

/**
 * Builds the structured webhook payload from the prediction and user objects.
 *
 * @param {object} prediction  — saved FloodPrediction record (with relations)
 * @param {object} user        — authenticated user { id, name, email, role }
 * @param {string} eventName   — ALERT_EVENTS constant
 * @returns {object}
 */
const buildPayload = (prediction, user, eventName) => ({
    // Event identifier — used by n8n to route to the correct workflow branch
    event: eventName,

    // ── User ────────────────────────────────────────────────────────────────
    user: {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
    },

    // ── Location ────────────────────────────────────────────────────────────
    location: {
        name:      prediction.locationName,
        latitude:  prediction.latitude,
        longitude: prediction.longitude,
        // Include resolved location relation fields when available
        state:     prediction.location?.state   ?? null,
        country:   prediction.location?.country ?? null,
    },

    // ── Weather ─────────────────────────────────────────────────────────────
    weather: {
        temperature: prediction.temperature,
        humidity:    prediction.humidity,
        rainfall:    prediction.rainfall,
        windSpeed:   prediction.windSpeed,
        pressure:    prediction.pressure,
    },

    // ── Prediction ──────────────────────────────────────────────────────────
    prediction: {
        id:             prediction.id,
        // Rule-based assessment
        riskLevel:      prediction.riskLevel,
        riskScore:      prediction.riskScore,
        reasons:        prediction.reasons,
        // Gemini weather analysis
        aiAnalysis:     prediction.aiAnalysis     ?? null,
        recommendation: prediction.recommendation ?? null,
        // Gemini image analysis
        imageAnalysis:  prediction.imageAnalysis  ?? null,
        floodSeverity:  prediction.floodSeverity  ?? null,
        confidence:     prediction.confidence     ?? null,
        rescuePriority: prediction.rescuePriority ?? null,
        // Linked report (when present)
        reportId:       prediction.reportId       ?? null,
    },

    // ── Timestamp ───────────────────────────────────────────────────────────
    timestamp: prediction.createdAt instanceof Date
        ? prediction.createdAt.toISOString()
        : prediction.createdAt,
});

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Evaluates a prediction and dispatches an alert when required.
 * Called fire-and-forget from predictionService — must never throw.
 *
 * @param {object} prediction  — saved FloodPrediction record (with relations)
 * @param {object} user        — authenticated user { id, name, email, role }
 */
const notifyIfHighRisk = async (prediction, user) => {
    if (!shouldAlert(prediction)) {
        return;
    }

    const eventName = resolveEventName(prediction);
    const payload   = buildPayload(prediction, user, eventName);

    logger.info("Flood alert condition met — dispatching notification.", {
        predictionId:   prediction.id,
        event:          eventName,
        riskLevel:      prediction.riskLevel,
        floodSeverity:  prediction.floodSeverity  ?? null,
        rescuePriority: prediction.rescuePriority ?? null,
        location:       prediction.locationName,
    });

    await triggerFloodAlert(payload);
};

module.exports = { notifyIfHighRisk };
