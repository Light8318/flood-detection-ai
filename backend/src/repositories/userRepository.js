/**
 * User Repository.
 * All Prisma operations for user management (used primarily by admin).
 */

const prisma = require("../config/prisma");

const findAllUsers = async ({ skip, take, role, isActive }) => {
    const where = {};
    if (role !== undefined)     where.role     = role;
    if (isActive !== undefined) where.isActive = isActive;

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take,
            select: {
                id:        true,
                name:      true,
                email:     true,
                role:      true,
                isActive:  true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
        }),
        prisma.user.count({ where }),
    ]);
    return { users, total };
};

const findUserById = async (id) => {
    return prisma.user.findUnique({
        where: { id },
        select: {
            id:        true,
            name:      true,
            email:     true,
            role:      true,
            isActive:  true,
            createdAt: true,
        },
    });
};

const updateUser = async (id, data) => {
    return prisma.user.update({
        where: { id },
        data,
        select: {
            id:       true,
            name:     true,
            email:    true,
            role:     true,
            isActive: true,
        },
    });
};

module.exports = { findAllUsers, findUserById, updateUser };
