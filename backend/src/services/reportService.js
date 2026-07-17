/**
 * Report Service.
 * Business logic for user flood reports lifecycle.
 */

const path = require("path");
const fs   = require("fs");
const env  = require("../config/env");
const {
    createReport,
    findAllReports,
    findReportById,
    updateReport,
    deleteReport,
} = require("../repositories/reportRepository");
const { parsePagination, paginationMeta, stripUndefined } = require("../utils/helper");

/**
 * Creates a new flood report submitted by a user.
 * @param {object} body     - validated request body
 * @param {object} user     - authenticated user
 * @param {object|null} file - Multer file object (optional)
 */
const submitReport = async (body, user, file) => {
    const imageUrl = file ? `/uploads/${file.filename}` : null;

    return createReport({
        description: body.description.trim(),
        address:     body.address.trim(),
        latitude:    body.latitude  ? parseFloat(body.latitude)  : null,
        longitude:   body.longitude ? parseFloat(body.longitude) : null,
        imageUrl,
        userId: user.id,
    });
};

/**
 * Returns paginated reports.
 * Regular users only see their own; admins see all with optional status filter.
 */
const listReports = async (query, userId, isAdmin) => {
    const { page, limit, skip } = parsePagination(query);

    const { reports, total } = await findAllReports({
        skip,
        take:   limit,
        status: query.status || undefined,
        userId: isAdmin ? undefined : userId,
    });

    return {
        reports,
        pagination: paginationMeta(total, page, limit),
    };
};

/**
 * Returns a single report.
 * Users can only see their own; admins see all.
 */
const getReport = async (id, userId, isAdmin) => {
    const report = await findReportById(id);

    if (!report) {
        const err = new Error("Report not found.");
        err.statusCode = 404;
        throw err;
    }

    if (!isAdmin && report.userId !== userId) {
        const err = new Error("Access denied.");
        err.statusCode = 403;
        throw err;
    }

    return report;
};

/**
 * Admin-only: updates report status and/or severity.
 */
const updateReportStatus = async (id, data) => {
    const report = await findReportById(id);
    if (!report) {
        const err = new Error("Report not found.");
        err.statusCode = 404;
        throw err;
    }

    return updateReport(id, stripUndefined({
        status:   data.status,
        severity: data.severity,
        notes:    data.notes,
    }));
};

/**
 * Deletes a report and its associated image file (if any).
 * Users can only delete their own; admins delete any.
 */
const removeReport = async (id, userId, isAdmin) => {
    const report = await findReportById(id);

    if (!report) {
        const err = new Error("Report not found.");
        err.statusCode = 404;
        throw err;
    }

    if (!isAdmin && report.userId !== userId) {
        const err = new Error("Access denied.");
        err.statusCode = 403;
        throw err;
    }

    // Remove uploaded image from disk.
    // report.imageUrl is stored as "/uploads/filename.jpg"; strip the leading
    // slash before joining so path.join doesn't treat it as an absolute path.
    if (report.imageUrl) {
        const filename = path.basename(report.imageUrl);
        const filePath = path.join(env.UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }

    return deleteReport(id);
};

module.exports = {
    submitReport,
    listReports,
    getReport,
    updateReportStatus,
    removeReport,
};
