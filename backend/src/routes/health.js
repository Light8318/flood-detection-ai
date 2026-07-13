const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
    res.json({
        success: true,
        status: "Healthy",
        message: "Flood Detection API is running"
    });
});

module.exports = router;