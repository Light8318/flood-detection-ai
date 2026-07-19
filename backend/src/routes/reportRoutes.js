/**
 * Report Routes.
 * POST   /api/reports         — authenticated users (with optional image upload)
 * GET    /api/reports         — authenticated (users see own; admins see all)
 * GET    /api/reports/:id     — authenticated
 * PATCH  /api/reports/:id/status — admin only
 * DELETE /api/reports/:id     — authenticated (own) or admin
 */

const express = require("express");
const router  = express.Router();

const reportController = require("../controllers/reportController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");
const upload           = require("../middleware/uploadMiddleware");
const { validate }     = require("../middleware/validationMiddleware");
const { uploadLimiter, apiLimiter } = require("../middleware/rateLimitMiddleware");
const {
    validateCreateReport,
    validateUpdateReportStatus,
} = require("../validators/reportValidator");

router.post(
    "/",
    authenticate,
    uploadLimiter,
    upload.single("image"),
    validate(validateCreateReport),
    reportController.submitReport
);

router.get("/",       authenticate, apiLimiter, reportController.listReports);
router.get("/:id/pdf", reportController.getReportPDF);
router.get("/:id",    authenticate, apiLimiter, reportController.getReport);

router.patch(
    "/:id/status",
    authenticate,
    requireAdmin,
    validate(validateUpdateReportStatus),
    reportController.updateReportStatus
);

router.delete("/:id", authenticate, apiLimiter, reportController.removeReport);

module.exports = router;
