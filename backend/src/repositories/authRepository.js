/**
 * Auth Repository.
 * All Prisma operations related to user authentication.
 */

const prisma = require("../config/prisma");

const findUserByEmail = async (email) => {
    return prisma.user.findUnique({
        where: { email },
    });
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

const createUser = async (userData) => {
    return prisma.user.create({
        data: userData,
    });
};

module.exports = { findUserByEmail, findUserById, createUser };
