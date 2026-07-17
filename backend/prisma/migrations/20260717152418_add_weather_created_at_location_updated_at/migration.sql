-- AlterTable: add nullable updatedAt to Location so existing rows default to NULL
ALTER TABLE `Location` ADD COLUMN `updatedAt` DATETIME(3) NULL;

-- AlterTable: add createdAt to WeatherData with current timestamp default
ALTER TABLE `WeatherData` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);
