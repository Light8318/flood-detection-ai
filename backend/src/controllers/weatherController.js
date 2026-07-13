const axios = require("axios");

const getWeather = async (req, res) => {
    try {
        const latitude = 21.1702; // Surat
        const longitude = 72.8311;

        const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,rain`;

        const response = await axios.get(url);

       const current = response.data.current;

res.json({
    success: true,
    data: {
        location: "Surat",
        temperature: current.temperature_2m,
        humidity: current.relative_humidity_2m,
        windSpeed: current.wind_speed_10m,
        rainfall: current.rain,
        updatedAt: current.time
    }
});
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Unable to fetch weather"
        });
    }
};

module.exports = {
    getWeather
};