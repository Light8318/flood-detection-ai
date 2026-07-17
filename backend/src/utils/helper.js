/**
 * Shared utility functions used across the application.
 */

const { PAGINATION } = require("./constants");

/**
 * Parses pagination query params and returns safe integers.
 * @param {object} query  - Express req.query
 * @returns {{ page: number, limit: number, skip: number }}
 */
const parsePagination = (query) => {
    const page  = Math.max(1, parseInt(query.page,  10) || PAGINATION.DEFAULT_PAGE);
    const limit = Math.min(
        PAGINATION.MAX_LIMIT,
        Math.max(1, parseInt(query.limit, 10) || PAGINATION.DEFAULT_LIMIT)
    );
    const skip = (page - 1) * limit;
    return { page, limit, skip };
};

/**
 * Builds a standard pagination metadata object.
 * @param {number} total - total record count
 * @param {number} page
 * @param {number} limit
 * @returns {object}
 */
const paginationMeta = (total, page, limit) => ({
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
});

/**
 * Strips undefined keys from an object so Prisma update payloads
 * only contain fields the caller explicitly set.
 * @param {object} obj
 * @returns {object}
 */
const stripUndefined = (obj) =>
    Object.fromEntries(
        Object.entries(obj).filter(([, v]) => v !== undefined)
    );

module.exports = { parsePagination, paginationMeta, stripUndefined };
