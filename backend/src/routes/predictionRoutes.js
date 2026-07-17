/**
 * Prediction Routes.
 *
 * POST /api/predictions              — run prediction
 *   - Query: lat, lon (required unless report has coords)
 *   - Body : reportId (optional, links prediction to a user report)
 *   - File : image    (optional, enables Gemini vision analysis)
 *
 * GET  /api/predictions              — paginated history
 * GET  /api/predictions/:id          — single prediction
 *
 * All routes require a valid JWT.
 */

const express = require("express");
const router  = express.Router();

const predictionController = require("../controllers/predictionController");
const { authenticate }     = require("../middleware/authMiddleware");
const { validate, validateQuery } = require("../middleware/validationMiddleware");
const { uploadLimiter, apiLimiter } = require("../middleware/rateLimitMiddleware");
const upload               = require("../middleware/uploadMiddleware");
const {
    validatePredictionBody,
    validatePredictionQuery,
    validatePredictionListQuery,
} = require("../validators/predictionValidator");

router.post(
    "/",
    authenticate,
    uploadLimiter,
    // Accept an optional image upload on the "image" field
    upload.single("image"),
    // Validate body (reportId format)
    validate(validatePredictionBody),
    // Validate lat/lon unless reportId is present (report provides coords)
    (req, res, next) => {
        if (req.body.reportId) return next();
        return validateQuery(validatePredictionQuery)(req, res, next);
    },
    predictionController.predict
);

router.get(
    "/",
    authenticate,
    apiLimiter,
    validateQuery(validatePredictionListQuery),
    predictionController.getHistory
);

router.get("/:id", authenticate, apiLimiter, predictionController.getById);

module.exports = router;
