/**
 * Auth Service.
 * Business logic for user registration, login, and profile retrieval.
 */

const bcrypt = require("bcrypt");
const { signToken }       = require("../utils/jwt");
const { ROLES }           = require("../utils/constants");
const {
    createUser,
    findUserByEmail,
    findUserById,
} = require("../repositories/authRepository");

const SALT_ROUNDS = 10;

const register = async (userData) => {
    const existing = await findUserByEmail(userData.email);
    if (existing) {
        const err = new Error("An account with this email already exists.");
        err.statusCode = 409;
        throw err;
    }

    const hashedPassword = await bcrypt.hash(userData.password, SALT_ROUNDS);

    const user = await createUser({
        name:     userData.name.trim(),
        email:    userData.email.toLowerCase(),
        password: hashedPassword,
        role:     userData.role || ROLES.USER,
    });

    return {
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
    };
};

const login = async (email, password) => {
    const user = await findUserByEmail(email.toLowerCase());

    if (!user || !user.isActive) {
        const err = new Error("Invalid credentials.");
        err.statusCode = 401;
        throw err;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
        const err = new Error("Invalid credentials.");
        err.statusCode = 401;
        throw err;
    }

    const token = signToken({
        id:    user.id,
        name:  user.name,
        email: user.email,
        role:  user.role,
    });

    return {
        token,
        user: {
            id:    user.id,
            name:  user.name,
            email: user.email,
            role:  user.role,
        },
    };
};

const getProfile = async (userId) => {
    const user = await findUserById(userId);
    if (!user) {
        const err = new Error("User not found.");
        err.statusCode = 404;
        throw err;
    }
    return user;
};

module.exports = { register, login, getProfile };
