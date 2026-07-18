/**
 * Report Repository.
 * All Prisma operations for flood reports.
 */

const prisma = require("../config/prisma");

const createReport = async (data) => {
    return prisma.report.create({
        data,
        include: {
            user: { select: { id: true, name: true, email: true } },
            predictions: true
        },
    });
};

const findAllReports = async ({ skip, take, status, userId, sortByPriority = false }) => {
    const where = {};
    if (status)  where.status = status;
    if (userId)  where.userId = userId;

    let reports = await prisma.report.findMany({
        where,
        include: {
            user: { select: { id: true, name: true, email: true } },
            predictions: true
        },
        orderBy: { createdAt: "desc" }
    });

    if (sortByPriority) {
        const SEVERITY_RANK = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
        reports.sort((a, b) => {
            const ra = SEVERITY_RANK[a.severity] ?? 4;
            const rb = SEVERITY_RANK[b.severity] ?? 4;
            if (ra !== rb) return ra - rb;
            return new Date(b.createdAt) - new Date(a.createdAt);
        });
    }

    const total = reports.length;
    if (skip !== undefined && take !== undefined) {
        reports = reports.slice(skip, skip + take);
    }

    return { reports, total };
};

const findReportById = async (id) => {
    return prisma.report.findUnique({
        where: { id },
        include: {
            user: { select: { id: true, name: true, email: true } },
            predictions: true
        },
    });
};

const updateReport = async (id, data) => {
    return prisma.report.update({
        where: { id },
        data,
        include: {
            user: { select: { id: true, name: true, email: true } },
            predictions: true
        },
    });
};

const deleteReport = async (id) => {
    return prisma.report.delete({ where: { id } });
};

const countReportsByStatus = async () => {
    return prisma.report.groupBy({
        by:      ["status"],
        _count:  { id: true },
    });
};

const countReportsBySeverity = async () => {
    return prisma.report.groupBy({
        by:      ["severity"],
        _count:  { id: true },
    });
};

module.exports = {
    createReport,
    findAllReports,
    findReportById,
    updateReport,
    deleteReport,
    countReportsByStatus,
    countReportsBySeverity,
};
