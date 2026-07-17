/**
 * Auth Routes.
 * POST /api/auth/register  — public
 * POST /api/auth/login     — public
 * GET  /api/auth/profile   — authenticated
 */

const express = require("express");
const router  = express.Router();

const authController                    = require("../controllers/authController");
const { authenticate }                  = require("../middleware/authMiddleware");
const { validate }                      = require("../middleware/validationMiddleware");
const { authLimiter }                   = require("../middleware/rateLimitMiddleware");
const { validateRegister, validateLogin } = require("../validators/authValidator");

router.post("/register", authLimiter, validate(validateRegister), authController.register);
router.post("/login",    authLimiter, validate(validateLogin),    authController.login);
router.get("/profile",   authenticate,                            authController.getProfile);

module.exports = router;
