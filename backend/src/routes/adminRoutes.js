/**
 * Admin Routes.
 * Every route is protected by authenticate + requireAdmin (applied via router.use).
 *
 * Dashboard
 *   GET  /api/admin/dashboard
 *
 * Users
 *   GET   /api/admin/users                    — list, filterable by role / isActive
 *   GET   /api/admin/users/:id                — single user
 *   PATCH /api/admin/users/:id/deactivate
 *   PATCH /api/admin/users/:id/reactivate
 *
 * Reports
 *   GET    /api/admin/reports                 — list, filterable by status
 *   GET    /api/admin/reports/:id             — single report
 *   PATCH  /api/admin/reports/:id/status      — update status + severity
 *   DELETE /api/admin/reports/:id
 *
 * Predictions
 *   GET  /api/admin/predictions               — list, filterable by riskLevel / userId / reportId
 *
 * Audit log
 *   GET  /api/admin/audit                     — admin action history
 */

const express = require("express");
const router  = express.Router();

const adminController  = require("../controllers/adminController");
const { authenticate } = require("../middleware/authMiddleware");
const { requireAdmin } = require("../middleware/adminMiddleware");
const { validate, validateQuery } = require("../middleware/validationMiddleware");
const { apiLimiter }   = require("../middleware/rateLimitMiddleware");
const { validateUpdateReportStatus } = require("../validators/reportValidator");
const { validateAdminUserListQuery, validateAdminPredictionListQuery } = require("../validators/adminValidator");

// Every admin route requires a valid JWT AND admin role
router.use(authenticate, requireAdmin);

// ── Dashboard ────────────────────────────────────────────────────────────────
router.get("/dashboard", apiLimiter, adminController.getDashboard);

// ── Users ────────────────────────────────────────────────────────────────────
router.get("/users",     apiLimiter, validateQuery(validateAdminUserListQuery), adminController.listUsers);
router.get("/users/:id", apiLimiter, adminController.getUser);
router.patch("/users/:id/deactivate", apiLimiter, adminController.deactivateUser);
router.patch("/users/:id/reactivate", apiLimiter, adminController.reactivateUser);

// ── Reports ───────────────────────────────────────────────────────────────────
router.get("/reports",     apiLimiter, adminController.listReports);
router.get("/reports/:id", apiLimiter, adminController.getReport);
router.patch(
    "/reports/:id/status",
    apiLimiter,
    validate(validateUpdateReportStatus),
    adminController.updateReportStatus
);
router.delete("/reports/:id", apiLimiter, adminController.deleteReport);

// ── Predictions ───────────────────────────────────────────────────────────────
router.get(
    "/predictions",
    apiLimiter,
    validateQuery(validateAdminPredictionListQuery),
    adminController.listPredictions
);

// ── Audit log ─────────────────────────────────────────────────────────────────
router.get("/audit", apiLimiter, adminController.listAuditLog);

module.exports = router;
