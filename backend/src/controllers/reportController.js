/**
 * Report Controller.
 * Receives HTTP requests and delegates to reportService.
 * Returns standardized API responses.
 */

const reportService = require("../services/reportService");
const response      = require("../utils/responseFormatter");
const { ROLES }     = require("../utils/constants");

const submitReport = async (req, res, next) => {
    try {
        const report = await reportService.submitReport(
            req.body,
            req.user,
            req.file || null
        );
        return response.success(res, "Report submitted successfully.", report, 201);
    } catch (err) {
        next(err);
    }
};

const listReports = async (req, res, next) => {
    try {
        const isAdmin = req.user.role === ROLES.ADMIN;
        const result  = await reportService.listReports(req.query, req.user.id, isAdmin);
        return response.success(res, "Reports retrieved successfully.", result);
    } catch (err) {
        next(err);
    }
};

const getReport = async (req, res, next) => {
    try {
        const isAdmin = req.user.role === ROLES.ADMIN;
        const report  = await reportService.getReport(
            parseInt(req.params.id, 10),
            req.user.id,
            isAdmin
        );
        return response.success(res, "Report retrieved successfully.", report);
    } catch (err) {
        next(err);
    }
};

const updateReportStatus = async (req, res, next) => {
    try {
        const report = await reportService.updateReportStatus(
            parseInt(req.params.id, 10),
            req.body
        );
        return response.success(res, "Report updated successfully.", report);
    } catch (err) {
        next(err);
    }
};

const removeReport = async (req, res, next) => {
    try {
        const isAdmin = req.user.role === ROLES.ADMIN;
        await reportService.removeReport(
            parseInt(req.params.id, 10),
            req.user.id,
            isAdmin
        );
        return response.success(res, "Report deleted successfully.");
    } catch (err) {
        next(err);
    }
};

const getReportPDF = async (req, res, next) => {
    try {
        const reportId = parseInt(req.params.id, 10);
        const reportData = await reportService.getReportDataForPDF(reportId);
        if (!reportData) {
            return res.status(404).json({
                success: false,
                message: "Report not found."
            });
        }

        const { generateIncidentReportPDF } = require("../services/pdfService");
        const pdfBuffer = await generateIncidentReportPDF(reportData);

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=IncidentReport_${reportId}.pdf`);
        
        const logger = require("../config/logger");
        logger.info("PDF downloaded");
        
        return res.send(pdfBuffer);
    } catch (err) {
        next(err);
    }
};

module.exports = { submitReport, listReports, getReport, updateReportStatus, removeReport, getReportPDF };
