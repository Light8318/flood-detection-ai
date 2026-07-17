/**
 * Application-wide constants.
 * All magic strings and numbers live here so there is a single source of truth.
 */

const ROLES = Object.freeze({
    USER:  "user",
    ADMIN: "admin",
});

const REPORT_STATUS = Object.freeze({
    PENDING:   "PENDING",
    REVIEWED:  "REVIEWED",
    RESOLVED:  "RESOLVED",
    DISMISSED: "DISMISSED",
});

const REPORT_SEVERITY = Object.freeze({
    UNKNOWN:  "UNKNOWN",
    LOW:      "LOW",
    MEDIUM:   "MEDIUM",
    HIGH:     "HIGH",
    CRITICAL: "CRITICAL",
});

const RISK_LEVELS = Object.freeze({
    LOW:    "LOW",
    MEDIUM: "MEDIUM",
    HIGH:   "HIGH",
});

// Gemini-assessed visual flood severity (from image analysis)
const FLOOD_SEVERITY = Object.freeze({
    NONE:     "NONE",
    MINOR:    "MINOR",
    MODERATE: "MODERATE",
    SEVERE:   "SEVERE",
    EXTREME:  "EXTREME",
});

// Gemini-assessed rescue urgency
const RESCUE_PRIORITY = Object.freeze({
    LOW:      "LOW",
    MEDIUM:   "MEDIUM",
    HIGH:     "HIGH",
    CRITICAL: "CRITICAL",
});

const ADMIN_ACTIONS = Object.freeze({
    UPDATE_REPORT_STATUS:   "UPDATE_REPORT_STATUS",
    DEACTIVATE_USER:        "DEACTIVATE_USER",
    REACTIVATE_USER:        "REACTIVATE_USER",
    DELETE_REPORT:          "DELETE_REPORT",
});

// Webhook event names sent to n8n
const ALERT_EVENTS = Object.freeze({
    FLOOD_HIGH_RISK:       "FLOOD_HIGH_RISK_DETECTED",
    FLOOD_CRITICAL_RESCUE: "FLOOD_CRITICAL_RESCUE_PRIORITY",
    FLOOD_EXTREME_VISUAL:  "FLOOD_EXTREME_SEVERITY_DETECTED",
});

// Conditions that trigger an alert — checked by notificationService
const ALERT_TRIGGER = Object.freeze({
    // rule-based risk levels that always fire an alert
    RISK_LEVELS:      ["HIGH"],
    // Gemini rescue priorities that fire an alert regardless of rule-based level
    RESCUE_PRIORITIES: ["CRITICAL"],
    // Gemini visual severities that fire an alert regardless of rule-based level
    FLOOD_SEVERITIES:  ["SEVERE", "EXTREME"],
});

const PAGINATION = Object.freeze({
    DEFAULT_PAGE:  1,
    DEFAULT_LIMIT: 10,
    MAX_LIMIT:     100,
});

module.exports = {
    ROLES,
    REPORT_STATUS,
    REPORT_SEVERITY,
    RISK_LEVELS,
    FLOOD_SEVERITY,
    RESCUE_PRIORITY,
    ADMIN_ACTIONS,
    ALERT_EVENTS,
    ALERT_TRIGGER,
    PAGINATION,
};
