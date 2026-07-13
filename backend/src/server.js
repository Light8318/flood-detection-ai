const express = require("express");

const healthRoute = require("./routes/health");
const weatherRoute = require("./routes/weather");

const app = express();

const PORT = 3000;

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Flood Detection AI Backend Running 🚀");
});

app.use("/health", healthRoute);
app.use("/api/weather", weatherRoute);

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});