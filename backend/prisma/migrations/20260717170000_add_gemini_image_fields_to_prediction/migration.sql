-- Add Gemini image-analysis output columns to FloodPrediction
ALTER TABLE `FloodPrediction`
    ADD COLUMN `imageAnalysis`  LONGTEXT NULL,
    ADD COLUMN `floodSeverity`  VARCHAR(20) NULL,
    ADD COLUMN `confidence`     DOUBLE NULL,
    ADD COLUMN `rescuePriority` VARCHAR(20) NULL;
