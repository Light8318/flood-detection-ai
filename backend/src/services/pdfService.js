const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const logger = require("../config/logger");

/**
 * Generates a professional PDF Incident Report.
 * @param {object} reportData - Object containing report details
 * @returns {Promise<Buffer>} PDF buffer
 */
const generateIncidentReportPDF = async (reportData) => {
    try {
        const pdfDoc = await PDFDocument.create();
        let page = pdfDoc.addPage([600, 850]);
        const { width, height } = page.getSize();
        
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // Header Background (Deep Blue Navy)
        page.drawRectangle({
            x: 0,
            y: height - 120,
            width: width,
            height: 120,
            color: rgb(0.07, 0.16, 0.29)
        });

        // App Logo Title
        page.drawText("FloodLine", {
            x: 40,
            y: height - 60,
            size: 28,
            font: fontBold,
            color: rgb(1, 1, 1)
        });

        // Document Title
        page.drawText("OFFICIAL INCIDENT REPORT", {
            x: 40,
            y: height - 85,
            size: 12,
            font: fontBold,
            color: rgb(0.8, 0.85, 0.9)
        });

        // Generation Metadata
        const generatedAt = new Date().toLocaleString("en-US", { timeZone: "UTC" });
        page.drawText(`System Log: ${generatedAt} UTC`, {
            x: 40,
            y: height - 105,
            size: 8,
            font: fontRegular,
            color: rgb(0.6, 0.65, 0.7)
        });

        let currentY = height - 160;

        // Helper function for page checking
        const checkPageOverflow = (neededHeight) => {
            if (currentY - neededHeight < 50) {
                page = pdfDoc.addPage([600, 850]);
                currentY = 800; // Reset Y coordinate on new page
                // Draw a simple header on subsequent page
                page.drawText("FloodLine - Incident Report (Cont.)", {
                    x: 40,
                    y: 820,
                    size: 10,
                    font: fontBold,
                    color: rgb(0.07, 0.16, 0.29)
                });
                page.drawLine({
                    start: { x: 40, y: 815 },
                    end: { x: 560, y: 815 },
                    thickness: 1,
                    color: rgb(0.8, 0.82, 0.85)
                });
            }
        };

        // Helper function for field rendering
        const drawField = (label, value, y) => {
            page.drawText(label + ":", {
                x: 40,
                y: y,
                size: 10,
                font: fontBold,
                color: rgb(0.15, 0.2, 0.25)
            });
            page.drawText(String(value ?? "N/A"), {
                x: 180,
                y: y,
                size: 10,
                font: fontRegular,
                color: rgb(0.25, 0.3, 0.35)
            });
        };

        // Section Title Helper
        const drawSectionHeader = (title) => {
            checkPageOverflow(30);
            page.drawText(title, {
                x: 40,
                y: currentY,
                size: 12,
                font: fontBold,
                color: rgb(0.07, 0.16, 0.29)
            });
            page.drawLine({
                start: { x: 40, y: currentY - 5 },
                end: { x: 560, y: currentY - 5 },
                thickness: 1,
                color: rgb(0.8, 0.82, 0.85)
            });
            currentY -= 25;
        };

        // Date and Time parsing from createdAt
        const dateStr = reportData.createdAt ? new Date(reportData.createdAt).toLocaleDateString() : "N/A";
        const timeStr = reportData.createdAt ? new Date(reportData.createdAt).toLocaleTimeString() : "N/A";

        // 1. Incident Record Section
        drawSectionHeader("1. Incident Identification");
        drawField("Incident ID", reportData.id, currentY); currentY -= 20;
        drawField("Status", reportData.status, currentY); currentY -= 20;
        drawField("Severity Rank", reportData.severity, currentY); currentY -= 20;
        drawField("Date Submitted", dateStr, currentY); currentY -= 20;
        drawField("Time Submitted", timeStr, currentY); currentY -= 35;

        // 2. Reporter & Geographic Details
        drawSectionHeader("2. Reporter & Location Details");
        drawField("Reporter Name", reportData.reporter, currentY); currentY -= 20;
        drawField("Email Address", reportData.email, currentY); currentY -= 20;
        drawField("Phone Contact", reportData.phone, currentY); currentY -= 20;
        drawField("Declared Location", reportData.location, currentY); currentY -= 20;
        drawField("Coordinates", `${reportData.latitude ?? "N/A"}, ${reportData.longitude ?? "N/A"}`, currentY); currentY -= 35;

        // 3. AI Predictive Analysis
        drawSectionHeader("3. AI Assessments & Predictions");
        drawField("Weather Flood Risk", reportData.weatherRisk, currentY); currentY -= 20;
        drawField("Rescue Priority", reportData.rescuePriority, currentY); currentY -= 35;

        // 4. Detailed Narrative & AI Analysis
        drawSectionHeader("4. Detailed Narrative & AI Analysis");

        page.drawText("Incident Description:", {
            x: 40,
            y: currentY,
            size: 10,
            font: fontBold,
            color: rgb(0.15, 0.2, 0.25)
        });
        currentY -= 15;

        const descText = reportData.description ?? "No description supplied.";
        const descLines = wrapText(descText, 95);
        descLines.forEach((line) => {
            checkPageOverflow(15);
            page.drawText(line, {
                x: 40,
                y: currentY,
                size: 9,
                font: fontRegular,
                color: rgb(0.3, 0.33, 0.36)
            });
            currentY -= 12;
        });

        currentY -= 15;

        checkPageOverflow(25);
        page.drawText("AI Incident Analysis:", {
            x: 40,
            y: currentY,
            size: 10,
            font: fontBold,
            color: rgb(0.15, 0.2, 0.25)
        });
        currentY -= 15;

        const aiText = reportData.aiAnalysis ?? "No AI Analysis was generated.";
        const aiLines = wrapText(aiText, 95);
        aiLines.forEach((line) => {
            checkPageOverflow(15);
            page.drawText(line, {
                x: 40,
                y: currentY,
                size: 9,
                font: fontRegular,
                color: rgb(0.3, 0.33, 0.36)
            });
            currentY -= 12;
        });

        currentY -= 15;

        // 5. Executive Summary
        checkPageOverflow(25);
        page.drawText("Executive Summary:", {
            x: 40,
            y: currentY,
            size: 10,
            font: fontBold,
            color: rgb(0.15, 0.2, 0.25)
        });
        currentY -= 15;

        const execSummary = reportData.executiveSummary ?? "N/A";
        const execLines = wrapText(execSummary, 95);
        execLines.forEach((line) => {
            checkPageOverflow(15);
            page.drawText(line, {
                x: 40,
                y: currentY,
                size: 9,
                font: fontRegular,
                color: rgb(0.3, 0.33, 0.36)
            });
            currentY -= 12;
        });

        currentY -= 15;

        // 6. Citizen Safety Instructions
        checkPageOverflow(25);
        page.drawText("Citizen Safety Instructions:", {
            x: 40,
            y: currentY,
            size: 10,
            font: fontBold,
            color: rgb(0.15, 0.2, 0.25)
        });
        currentY -= 15;

        const safetyInst = reportData.safetyInstructions ?? "N/A";
        const safetyLines = wrapText(safetyInst, 95);
        safetyLines.forEach((line) => {
            checkPageOverflow(15);
            page.drawText(line, {
                x: 40,
                y: currentY,
                size: 9,
                font: fontRegular,
                color: rgb(0.3, 0.33, 0.36)
            });
            currentY -= 12;
        });

        const pdfBytes = await pdfDoc.save();
        logger.info("PDF generated");
        return Buffer.from(pdfBytes);
    } catch (err) {
        logger.error("Failed to generate PDF", { message: err.message });
        throw err;
    }
};

/**
 * Utility to wrap lines to prevent horizontal overflow in pdf document drawing.
 */
const wrapText = (text, maxLength) => {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = "";

    words.forEach((word) => {
        if ((currentLine + " " + word).trim().length <= maxLength) {
            currentLine += (currentLine === "" ? "" : " ") + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    });

    if (currentLine !== "") {
        lines.push(currentLine);
    }

    return lines;
};

module.exports = { generateIncidentReportPDF };
