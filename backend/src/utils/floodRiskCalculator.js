const calculateFloodRisk = (weather) => {

    let score = 0;
    const reasons = [];

    // Rainfall
    if (weather.rainfall >= 50) {
        score += 50;
        reasons.push("Very heavy rainfall");
    } else if (weather.rainfall >= 20) {
        score += 25;
        reasons.push("Moderate rainfall");
    }

    // Humidity
    if (weather.humidity >= 90) {
        score += 20;
        reasons.push("Very high humidity");
    } else if (weather.humidity >= 80) {
        score += 10;
        reasons.push("High humidity");
    }

    // Wind Speed
    if (weather.windSpeed >= 40) {
        score += 20;
        reasons.push("Strong winds");
    }

    // Pressure
    if (weather.pressure <= 995) {
        score += 20;
        reasons.push("Low atmospheric pressure");
    }

    let level = "LOW";

    if (score >= 70)
        level = "HIGH";
    else if (score >= 40)
        level = "MEDIUM";

    return {
        score,
        level,
        reasons
    };
};

module.exports = {
    calculateFloodRisk
};