/**
 * Admin Repository.
 * All Prisma operations for admin audit actions.
 * Keeps direct Prisma access out of controllers and services.
 */

const prisma = require("../config/prisma");

/**
 * Records one admin action in the audit log.
 *
 * @param {object} data
 * @param {string} data.action     — ADMIN_ACTIONS constant
 * @param {string} data.targetType — "Report" | "User" | etc.
 * @param {number} data.targetId
 * @param {number} data.adminId
 * @param {string} [data.notes]
 * @returns {Promise<object>}
 */
const createAdminAction = async ({ action, targetType, targetId, adminId, notes }) => {
    return prisma.adminAction.create({
        data: {
            action,
            targetType,
            targetId,
            adminId,
            notes: notes || null,
        },
    });
};

/**
 * Returns paginated admin action history, newest first.
 * Optionally filter by adminId or targetType.
 *
 * @param {object} params
 * @param {number}  params.skip
 * @param {number}  params.take
 * @param {number}  [params.adminId]
 * @param {string}  [params.targetType]
 * @returns {Promise<{ actions: object[], total: number }>}
 */
const findAllAdminActions = async ({ skip, take, adminId, targetType }) => {
    const where = {};
    if (adminId)    where.adminId    = adminId;
    if (targetType) where.targetType = targetType;

    const [actions, total] = await Promise.all([
        prisma.adminAction.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: {
                admin: { select: { id: true, name: true, email: true } },
            },
        }),
        prisma.adminAction.count({ where }),
    ]);

    return { actions, total };
};

/**
 * Returns aggregate counts for the admin dashboard in a single round-trip.
 *
 * @returns {Promise<{ totalUsers: number, totalReports: number, totalPredictions: number }>}
 */
const getDashboardCounts = async () => {
    const [totalUsers, totalReports, totalPredictions] = await Promise.all([
        prisma.user.count(),
        prisma.report.count(),
        prisma.floodPrediction.count(),
    ]);

    return { totalUsers, totalReports, totalPredictions };
};

module.exports = { createAdminAction, findAllAdminActions, getDashboardCounts };
