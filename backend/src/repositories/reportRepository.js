/**
 * Report Repository.
 * All Prisma operations for flood reports.
 */

const prisma = require("../config/prisma");

const createReport = async (data) => {
    return prisma.report.create({
        data,
        include: { user: { select: { id: true, name: true, email: true } } },
    });
};

const findAllReports = async ({ skip, take, status, userId }) => {
    const where = {};
    if (status)  where.status = status;
    if (userId)  where.userId = userId;

    const [reports, total] = await Promise.all([
        prisma.report.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: { user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.report.count({ where }),
    ]);

    return { reports, total };
};

const findReportById = async (id) => {
    return prisma.report.findUnique({
        where: { id },
        include: { user: { select: { id: true, name: true, email: true } } },
    });
};

const updateReport = async (id, data) => {
    return prisma.report.update({
        where: { id },
        data,
        include: { user: { select: { id: true, name: true, email: true } } },
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

module.exports = {
    createReport,
    findAllReports,
    findReportById,
    updateReport,
    deleteReport,
    countReportsByStatus,
};
