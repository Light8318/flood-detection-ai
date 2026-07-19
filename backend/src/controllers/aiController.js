const geminiService = require("../services/geminiService");
const logger        = require("../config/logger");

const generateCommunication = async (req, res, next) => {
    try {
        logger.info("Gemini Started");
        
        const communication = await geminiService.generateEmergencyCommunication(req.body);
        
        logger.info("Gemini Completed");
        return res.json(communication);
    } catch (err) {
        logger.error("AI Communication controller error: " + err.message);
        next(err);
    }
};

module.exports = { generateCommunication };
