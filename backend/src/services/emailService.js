const { Resend } = require("resend");
const env        = require("../config/env");
const logger     = require("../config/logger");

let resend = null;
if (env.RESEND_API_KEY) {
    try {
        resend = new Resend(env.RESEND_API_KEY);
    } catch (err) {
        logger.error("Failed to initialize Resend client", { message: err.message });
    }
} else {
    logger.warn("RESEND_API_KEY not configured — email service will not send emails.");
}

/**
 * Sends an email with the Incident Report PDF attached.
 * @param {object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body
 * @param {Buffer|null} options.pdfBuffer - PDF attachment buffer (optional)
 * @returns {Promise<boolean>} success status
 */
const sendEmergencyEmail = async ({ to, subject, html, pdfBuffer }) => {
    if (!resend) {
        logger.warn("Resend client not initialized — skipping email sending.");
        return false;
    }

    try {
        const attachments = [];
        if (pdfBuffer) {
            attachments.push({
                filename: "IncidentReport.pdf",
                content: pdfBuffer,
            });
        }

        const data = await resend.emails.send({
            from: "FloodLine Alerts <alerts@floodline.gov>",
            to: [to],
            subject: subject,
            html: html,
            attachments: attachments
        });

        logger.info("Email sent", { id: data ? data.id : null });
        return true;
    } catch (err) {
        logger.error("Failed to send email via Resend SDK", { message: err.message });
        return false;
    }
};

module.exports = { sendEmergencyEmail };
