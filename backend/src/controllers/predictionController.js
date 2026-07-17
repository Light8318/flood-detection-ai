/**
 * Prediction Controller.
 * Receives HTTP requests and delegates to predictionService.
 * Returns standardized API responses.
 */

const predictionService = require("../services/predictionService");
const response          = require("../utils/responseFormatter");
const { ROLES }         = require("../utils/constants");

/**
 * POST /api/predictions?lat=&lon=
 * Content-Type: multipart/form-data OR application/json
 * Body (optional): { reportId }
 * File (optional): image field
 *
 * When an image is uploaded it is passed through Gemini vision analysis.
 * When reportId is provided the prediction is linked to that report.
 * If the report has coordinates and lat/lon are omitted, the report's
 * coordinates are used automatically.
 */
const predict = async (req, res, next) => {
    try {
        const { lat, lon } = req.query;

        const reportId = req.body.reportId
            ? parseInt(req.body.reportId, 10)
            : null;

        // req.file is set by Multer when an image field is present
        const imageUrl = req.file
            ? `/uploads/${req.file.filename}`
            : null;

        const prediction = await predictionService.predict(
            lat, lon, req.user, reportId, imageUrl
        );

        return response.success(res, "Flood prediction generated successfully.", prediction, 201);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/predictions?page=&limit=&riskLevel=&reportId=
 * Returns paginated history. Users see their own; admins see all.
 */
const getHistory = async (req, res, next) => {
    try {
        const isAdmin = req.user.role === ROLES.ADMIN;
        const result  = await predictionService.getHistory(req.query, req.user.id, isAdmin);
        return response.success(res, "Prediction history retrieved successfully.", result);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/predictions/:id
 */
const getById = async (req, res, next) => {
    try {
        const isAdmin    = req.user.role === ROLES.ADMIN;
        const prediction = await predictionService.getById(
            parseInt(req.params.id, 10),
            req.user.id,
            isAdmin
        );
        return response.success(res, "Prediction retrieved successfully.", prediction);
    } catch (err) {
        next(err);
    }
};

module.exports = { predict, getHistory, getById };
