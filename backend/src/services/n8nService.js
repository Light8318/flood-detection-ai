/**
 * n8n Service.
 *
 * Responsible for the HTTP delivery of alert payloads to an n8n webhook.
 * n8n handles all downstream delivery (email, SMS, Telegram, Slack, etc.).
 *
 * Design decisions:
 *  - One linear retry with exponential back-off (max 2 attempts) on transient
 *    failures (network error or 5xx response). 4xx errors are not retried.
 *  - Every attempt is logged with its outcome.
 *  - The function never throws — notification is always best-effort so the
 *    prediction pipeline is never blocked by a delivery failure.
 */

const axios  = require("axios");
const env    = require("../config/env");
const logger = require("../config/logger");

const MAX_ATTEMPTS   = 2;
const TIMEOUT_MS     = 10000;
const RETRY_DELAY_MS = 2000;

/**
 * Returns true for error conditions that are worth retrying
 * (network/timeout failures or 5xx responses).
 * @param {Error} err  — Axios error
 * @returns {boolean}
 */
const isRetryable = (err) => {
    if (!err.response) return true;                    // network / timeout
    return err.response.status >= 500;                 // server-side failure
};

/**
 * Fires a POST request to the configured n8n webhook URL.
 * Retries once on retryable failures with a fixed delay.
 * Never throws — all outcomes are logged.
 *
 * @param {object} payload  — structured alert object built by notificationService
 */
const triggerFloodAlert = async (payload) => {
    if (!env.N8N_WEBHOOK_URL) {
        logger.warn("N8N_WEBHOOK_URL is not configured — flood alert not dispatched.", {
            event: payload.event,
        });
        return;
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
            const response = await axios.post(env.N8N_WEBHOOK_URL, payload, {
                headers: { "Content-Type": "application/json" },
                timeout: TIMEOUT_MS,
            });

            logger.info("n8n flood alert delivered.", {
                event:      payload.event,
                statusCode: response.status,
                attempt,
            });

            return; // success — stop

        } catch (err) {
            const statusCode = err.response?.status ?? null;
            const retryable  = isRetryable(err);

            logger.warn(`n8n flood alert attempt ${attempt} failed.`, {
                event:      payload.event,
                statusCode,
                message:    err.message,
                willRetry:  retryable && attempt < MAX_ATTEMPTS,
            });

            // Do not retry on 4xx — those are configuration errors
            if (!retryable || attempt === MAX_ATTEMPTS) {
                logger.error("n8n flood alert permanently failed — giving up.", {
                    event:      payload.event,
                    statusCode,
                    message:    err.message,
                });
                return;
            }

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
};

module.exports = { triggerFloodAlert };
