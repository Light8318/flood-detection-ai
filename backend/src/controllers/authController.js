/**
 * Auth Controller.
 * Receives HTTP requests and delegates to authService.
 * Returns standardized API responses.
 */

const authService = require("../services/authService");
const response    = require("../utils/responseFormatter");

const register = async (req, res, next) => {
    try {
        const user = await authService.register(req.body);
        return response.success(res, "Registration successful.", user, 201);
    } catch (err) {
        next(err);
    }
};

const login = async (req, res, next) => {
    try {
        const result = await authService.login(req.body.email, req.body.password);
        return response.success(res, "Login successful.", result);
    } catch (err) {
        next(err);
    }
};

const getProfile = async (req, res, next) => {
    try {
        const user = await authService.getProfile(req.user.id);
        return response.success(res, "Profile retrieved successfully.", user);
    } catch (err) {
        next(err);
    }
};

module.exports = { register, login, getProfile };
