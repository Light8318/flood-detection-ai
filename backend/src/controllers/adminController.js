/**
 * Admin Controller.
 * Receives HTTP requests for admin operations.
 * Delegates all business logic to services and repositories.
 * Never accesses Prisma directly.
 */

const userRepository    = require("../repositories/userRepository");
const adminRepository   = require("../repositories/adminRepository");
const reportService     = require("../services/reportService");
const {
    findAllPredictions,
    countPredictionsByRiskLevel,
} = require("../repositories/predictionRepository");
const {
    countReportsByStatus,
    countReportsBySeverity,
    findReportById,
} = require("../repositories/reportRepository");
const { ADMIN_ACTIONS } = require("../utils/constants");
const { parsePagination, paginationMeta } = require("../utils/helper");
const response          = require("../utils/responseFormatter");

// ── Dashboard ────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/dashboard
 * Aggregate counts used by the admin overview screen.
 */
const getDashboard = async (req, res, next) => {
    try {
        const [
            { totalUsers, totalReports, totalPredictions },
            reportsByStatus,
            reportsBySeverity,
        ] = await Promise.all([
            adminRepository.getDashboardCounts(),
            countReportsByStatus(),
            countReportsBySeverity(),
        ]);

        const reportStats     = Object.fromEntries(
            reportsByStatus.map((r) => [r.status, r._count.id])
        );
        const severityStats   = Object.fromEntries(
            reportsBySeverity.map((r) => [r.severity, r._count.id])
        );

        // Ensure all severity categories contribute exactly one count or default to 0
        const categories = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
        for (const cat of categories) {
            if (!(cat in severityStats)) {
                severityStats[cat] = 0;
            }
        }

        return response.success(res, "Dashboard data retrieved.", {
            totalUsers,
            totalReports,
            totalPredictions,
            reportsByStatus:   reportStats,
            predictionsByRisk: severityStats,
            reportsBySeverity: severityStats,
        });
    } catch (err) {
        next(err);
    }
};

// ── Users ────────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/users?page=&limit=&role=&isActive=
 * Paginated user list with optional role and isActive filters.
 */
const listUsers = async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);

        // Parse optional filters from query string
        const role     = req.query.role     || undefined;
        const isActive = req.query.isActive !== undefined
            ? req.query.isActive === "true"
            : undefined;

        const { users, total } = await userRepository.findAllUsers({
            skip,
            take:     limit,
            role,
            isActive,
        });

        return response.success(res, "Users retrieved successfully.", {
            users,
            pagination: paginationMeta(total, page, limit),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/admin/users/:id
 */
const getUser = async (req, res, next) => {
    try {
        const user = await userRepository.findUserById(parseInt(req.params.id, 10));
        if (!user) return response.error(res, "User not found.", 404);
        return response.success(res, "User retrieved successfully.", user);
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/admin/users/:id/deactivate
 */
const deactivateUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const user   = await userRepository.updateUser(userId, { isActive: false });

        await adminRepository.createAdminAction({
            action:     ADMIN_ACTIONS.DEACTIVATE_USER,
            targetType: "User",
            targetId:   userId,
            adminId:    req.user.id,
            notes:      req.body.notes,
        });

        return response.success(res, "User deactivated successfully.", user);
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/admin/users/:id/reactivate
 */
const reactivateUser = async (req, res, next) => {
    try {
        const userId = parseInt(req.params.id, 10);
        const user   = await userRepository.updateUser(userId, { isActive: true });

        await adminRepository.createAdminAction({
            action:     ADMIN_ACTIONS.REACTIVATE_USER,
            targetType: "User",
            targetId:   userId,
            adminId:    req.user.id,
            notes:      req.body.notes,
        });

        return response.success(res, "User reactivated successfully.", user);
    } catch (err) {
        next(err);
    }
};

// ── Reports ───────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/reports?page=&limit=&status=
 * Returns all reports across all users with optional status filter.
 */
const listReports = async (req, res, next) => {
    try {
        const result = await reportService.listReports(req.query, req.user.id, true);
        return response.success(res, "Reports retrieved successfully.", result);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/admin/reports/:id
 * Returns a single report regardless of owner.
 */
const getReport = async (req, res, next) => {
    try {
        const report = await findReportById(parseInt(req.params.id, 10));
        if (!report) return response.error(res, "Report not found.", 404);
        return response.success(res, "Report retrieved successfully.", report);
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/admin/reports/:id/status
 * Updates status and/or severity. Writes an audit log entry.
 */
const updateReportStatus = async (req, res, next) => {
    try {
        const reportId = parseInt(req.params.id, 10);
        const report   = await reportService.updateReportStatus(reportId, req.body);

        await adminRepository.createAdminAction({
            action:     ADMIN_ACTIONS.UPDATE_REPORT_STATUS,
            targetType: "Report",
            targetId:   reportId,
            adminId:    req.user.id,
            notes:      `Status set to ${req.body.status}${req.body.severity ? `, severity ${req.body.severity}` : ""}`,
        });

        return response.success(res, "Report status updated successfully.", report);
    } catch (err) {
        next(err);
    }
};

/**
 * DELETE /api/admin/reports/:id
 * Hard-deletes the report and its image file. Writes an audit log entry.
 */
const deleteReport = async (req, res, next) => {
    try {
        const reportId = parseInt(req.params.id, 10);
        await reportService.removeReport(reportId, req.user.id, true);

        await adminRepository.createAdminAction({
            action:     ADMIN_ACTIONS.DELETE_REPORT,
            targetType: "Report",
            targetId:   reportId,
            adminId:    req.user.id,
        });

        return response.success(res, "Report deleted successfully.");
    } catch (err) {
        next(err);
    }
};

// ── Predictions ───────────────────────────────────────────────────────────────

/**
 * GET /api/admin/predictions?page=&limit=&riskLevel=&userId=&reportId=
 * Returns all predictions across all users.
 * Supports filtering by riskLevel, userId, and reportId.
 */
const listPredictions = async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);

        const userId   = req.query.userId   ? parseInt(req.query.userId,   10) : undefined;
        const reportId = req.query.reportId ? parseInt(req.query.reportId, 10) : undefined;

        const { predictions, total } = await findAllPredictions({
            skip,
            take:      limit,
            userId,
            reportId,
            riskLevel: req.query.riskLevel || undefined,
        });

        return response.success(res, "Predictions retrieved successfully.", {
            predictions,
            pagination: paginationMeta(total, page, limit),
        });
    } catch (err) {
        next(err);
    }
};

// ── Audit log ─────────────────────────────────────────────────────────────────

/**
 * GET /api/admin/audit?page=&limit=&targetType=
 * Returns the admin action audit log, newest first.
 */
const listAuditLog = async (req, res, next) => {
    try {
        const { page, limit, skip } = parsePagination(req.query);

        const { actions, total } = await adminRepository.findAllAdminActions({
            skip,
            take:       limit,
            targetType: req.query.targetType || undefined,
        });

        return response.success(res, "Audit log retrieved successfully.", {
            actions,
            pagination: paginationMeta(total, page, limit),
        });
    } catch (err) {
        next(err);
    }
};

/**
 * PATCH /api/admin/reports/:id/respond
 * Saves administrative reply to report. Writes an audit log entry.
 */
const respondToReport = async (req, res, next) => {
    try {
        const reportId = parseInt(req.params.id, 10);
        
        if (!req.body.adminResponse || req.body.adminResponse.trim().length === 0) {
            return response.error(res, "Admin response is required.", 400);
        }

        const adminName = req.user.name || req.user.email || "Admin";

        const report = await reportService.respondToReport(reportId, req.body, adminName);

        await adminRepository.createAdminAction({
            action:     ADMIN_ACTIONS.UPDATE_REPORT_STATUS,
            targetType: "Report",
            targetId:   reportId,
            adminId:    req.user.id,
            notes:      `Responded: "${req.body.adminResponse}"`,
        });

        return response.success(res, "Admin response saved successfully.", report);
    } catch (err) {
        next(err);
    }
};

module.exports = {
    getDashboard,
    listUsers,
    getUser,
    deactivateUser,
    reactivateUser,
    listReports,
    getReport,
    updateReportStatus,
    respondToReport,
    deleteReport,
    listPredictions,
    listAuditLog,
};
