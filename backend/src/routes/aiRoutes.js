const express = require("express");
const router  = express.Router();
const aiController = require("../controllers/aiController");

router.post("/communication", aiController.generateCommunication);

module.exports = router;
