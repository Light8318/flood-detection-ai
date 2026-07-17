/**
 * Prediction Repository.
 * All Prisma operations for flood predictions.
 */

const prisma = require("../config/prisma");

// Reusable include block — always eager-load user and, when present, report
const PREDICTION_INCLUDE = {
    user: {
        select: { id: true, name: true, email: true },
    },
    report: {
        select: {
            id:          true,
            description: true,
            address:     true,
            latitude:    true,
            longitude:   true,
            status:      true,
            severity:    true,
        },
    },
    location: {
        select: {
            id:      true,
            name:    true,
            state:   true,
            country: true,
        },
    },
};

/**
 * Persists a new FloodPrediction row.
 * @param {object} data
 * @returns {Promise<object>}
 */
const createPrediction = async (data) => {
    return prisma.floodPrediction.create({
        data,
        include: PREDICTION_INCLUDE,
    });
};

/**
 * Returns a paginated list of predictions.
 * Supports filtering by userId, riskLevel, and reportId.
 *
 * @param {object} params
 * @param {number}  params.skip
 * @param {number}  params.take
 * @param {number}  [params.userId]
 * @param {string}  [params.riskLevel]
 * @param {number}  [params.reportId]
 * @returns {Promise<{ predictions: object[], total: number }>}
 */
const findAllPredictions = async ({ skip, take, userId, riskLevel, reportId }) => {
    const where = {};
    if (userId)   where.userId   = userId;
    if (riskLevel) where.riskLevel = riskLevel;
    if (reportId) where.reportId = reportId;

    const [predictions, total] = await Promise.all([
        prisma.floodPrediction.findMany({
            where,
            skip,
            take,
            orderBy: { createdAt: "desc" },
            include: PREDICTION_INCLUDE,
        }),
        prisma.floodPrediction.count({ where }),
    ]);

    return { predictions, total };
};

/**
 * Returns a single prediction by id with all relations included.
 * @param {number} id
 * @returns {Promise<object|null>}
 */
const findPredictionById = async (id) => {
    return prisma.floodPrediction.findUnique({
        where: { id },
        include: PREDICTION_INCLUDE,
    });
};

/**
 * Groups predictions by riskLevel for dashboard stats.
 * @returns {Promise<object[]>}
 */
const countPredictionsByRiskLevel = async () => {
    return prisma.floodPrediction.groupBy({
        by:     ["riskLevel"],
        _count: { id: true },
    });
};

module.exports = {
    createPrediction,
    findAllPredictions,
    findPredictionById,
    countPredictionsByRiskLevel,
};
