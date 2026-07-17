-- Add back-relation: Report.predictions (no DB change needed, Prisma-only)
-- Add reportId FK on FloodPrediction → Report (nullable)
ALTER TABLE `FloodPrediction`
    ADD COLUMN `reportId` INT NULL,
    ADD CONSTRAINT `FloodPrediction_reportId_fkey`
        FOREIGN KEY (`reportId`) REFERENCES `Report` (`id`)
        ON DELETE SET NULL ON UPDATE CASCADE;
