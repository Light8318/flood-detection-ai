/**
 * OpenAPI 3.0 specification for the Flood Detection AI API.
 * Mounted at /api/docs via swagger-ui-express in app.js.
 */

const env = require("../config/env");

// ── Reusable response schemas ─────────────────────────────────────────────────

const ApiSuccess = (dataSchema) => ({
    type: "object",
    properties: {
        success:   { type: "boolean", example: true },
        message:   { type: "string" },
        data:      dataSchema,
        timestamp: { type: "string", format: "date-time" },
    },
});

const ApiError = {
    type: "object",
    properties: {
        success:   { type: "boolean", example: false },
        message:   { type: "string" },
        data:      { nullable: true, example: null },
        timestamp: { type: "string", format: "date-time" },
    },
};

const Pagination = {
    type: "object",
    properties: {
        total:      { type: "integer", example: 42 },
        page:       { type: "integer", example: 1 },
        limit:      { type: "integer", example: 10 },
        totalPages: { type: "integer", example: 5 },
    },
};

// ── Shared parameters ─────────────────────────────────────────────────────────

const PageParam = { in: "query", name: "page",  schema: { type: "integer", default: 1 },  description: "Page number" };
const LimitParam = { in: "query", name: "limit", schema: { type: "integer", default: 10 }, description: "Records per page (max 100)" };

// ── Security scheme ───────────────────────────────────────────────────────────

const BearerAuth = { bearerAuth: [] };

// ── Base server URL ───────────────────────────────────────────────────────────

const serverUrl = `http://localhost:${env.PORT}`;

// =============================================================================
// SPEC
// =============================================================================

const swaggerSpec = {
    openapi: "3.0.3",
    info: {
        title:       "Flood Detection AI API",
        version:     "1.0.0",
        description: [
            "Production-ready REST API for the AI-powered Flood Detection and Disaster Response System.",
            "",
            "## Authentication",
            "Most endpoints require a **Bearer JWT** token.",
            "Obtain one from `POST /api/auth/login` and pass it as:",
            "```",
            "Authorization: Bearer <token>",
            "```",
            "",
            "## Role-based access",
            "- **user** — standard authenticated user",
            "- **admin** — full access including admin namespace (`/api/admin/*`)",
        ].join("\n"),
        contact: { name: "Flood Detection AI" },
    },
    servers: [
        { url: serverUrl, description: "Local development server" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type:         "http",
                scheme:       "bearer",
                bearerFormat: "JWT",
                description:  "JWT issued by POST /api/auth/login",
            },
        },
        schemas: {

            // ── Auth ──────────────────────────────────────────────────────────
            RegisterRequest: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                    name:     { type: "string", minLength: 2, example: "Alice Tan" },
                    email:    { type: "string", format: "email", example: "alice@example.com" },
                    password: { type: "string", minLength: 8, example: "password123" },
                    role:     { type: "string", enum: ["user", "admin"], default: "user" },
                },
            },
            LoginRequest: {
                type: "object",
                required: ["email", "password"],
                properties: {
                    email:    { type: "string", format: "email", example: "alice@example.com" },
                    password: { type: "string", example: "password123" },
                },
            },
            UserPublic: {
                type: "object",
                properties: {
                    id:        { type: "integer", example: 1 },
                    name:      { type: "string",  example: "Alice Tan" },
                    email:     { type: "string",  format: "email", example: "alice@example.com" },
                    role:      { type: "string",  enum: ["user", "admin"] },
                    isActive:  { type: "boolean", example: true },
                    createdAt: { type: "string",  format: "date-time" },
                },
            },
            LoginData: {
                type: "object",
                properties: {
                    token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                    user:  { $ref: "#/components/schemas/UserPublic" },
                },
            },

            // ── Weather ───────────────────────────────────────────────────────
            FloodRisk: {
                type: "object",
                properties: {
                    level:   { type: "string", enum: ["LOW", "MEDIUM", "HIGH"], example: "HIGH" },
                    score:   { type: "integer", example: 90 },
                    reasons: { type: "array", items: { type: "string" }, example: ["Very heavy rainfall", "Very high humidity"] },
                },
            },
            WeatherCurrent: {
                type: "object",
                properties: {
                    location:    { type: "string",  example: "Kuala Lumpur" },
                    state:       { type: "string",  example: "Kuala Lumpur" },
                    country:     { type: "string",  example: "Malaysia" },
                    latitude:    { type: "number",  example: 3.147 },
                    longitude:   { type: "number",  example: 101.695 },
                    temperature: { type: "number",  example: 29.4 },
                    humidity:    { type: "integer", example: 92 },
                    rainfall:    { type: "number",  example: 55.0 },
                    windSpeed:   { type: "number",  example: 46.2 },
                    pressure:    { type: "number",  example: 991.0 },
                    timestamp:   { type: "string",  example: "2025-07-17T10:00" },
                    floodRisk:   { $ref: "#/components/schemas/FloodRisk" },
                },
            },
            WeatherRecord: {
                type: "object",
                properties: {
                    id:          { type: "integer" },
                    temperature: { type: "number" },
                    humidity:    { type: "integer" },
                    rainfall:    { type: "number" },
                    windSpeed:   { type: "number" },
                    pressure:    { type: "number", nullable: true },
                    timestamp:   { type: "string", format: "date-time" },
                    createdAt:   { type: "string", format: "date-time" },
                    location: {
                        type: "object",
                        properties: {
                            id:      { type: "integer" },
                            name:    { type: "string" },
                            state:   { type: "string", nullable: true },
                            country: { type: "string", nullable: true },
                        },
                    },
                },
            },

            // ── Reports ───────────────────────────────────────────────────────
            ReportCreateRequest: {
                type: "object",
                required: ["description", "address"],
                properties: {
                    description: { type: "string", minLength: 10, example: "Severe flooding observed near the riverbank." },
                    address:     { type: "string", example: "Jalan Masjid India, Kuala Lumpur" },
                    latitude:    { type: "number", example: 3.1478 },
                    longitude:   { type: "number", example: 101.6953 },
                    image:       { type: "string", format: "binary", description: "Optional flood photo (JPEG/PNG/WebP, max 5 MB)" },
                },
            },
            ReportStatusUpdateRequest: {
                type: "object",
                required: ["status"],
                properties: {
                    status:   { type: "string", enum: ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"] },
                    severity: { type: "string", enum: ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                },
            },
            Report: {
                type: "object",
                properties: {
                    id:          { type: "integer", example: 1 },
                    description: { type: "string",  example: "Severe flooding observed near the riverbank." },
                    imageUrl:    { type: "string",  nullable: true, example: "/uploads/1720000000000-123456789.jpg" },
                    address:     { type: "string",  example: "Jalan Masjid India, KL" },
                    latitude:    { type: "number",  nullable: true, example: 3.1478 },
                    longitude:   { type: "number",  nullable: true, example: 101.6953 },
                    status:      { type: "string",  enum: ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"], example: "PENDING" },
                    severity:    { type: "string",  enum: ["UNKNOWN", "LOW", "MEDIUM", "HIGH", "CRITICAL"], example: "UNKNOWN" },
                    createdAt:   { type: "string",  format: "date-time" },
                    updatedAt:   { type: "string",  format: "date-time" },
                    user: {
                        type: "object",
                        properties: {
                            id:    { type: "integer" },
                            name:  { type: "string" },
                            email: { type: "string" },
                        },
                    },
                },
            },

            // ── Predictions ───────────────────────────────────────────────────
            FloodPrediction: {
                type: "object",
                properties: {
                    id:             { type: "integer", example: 7 },
                    riskLevel:      { type: "string",  enum: ["LOW", "MEDIUM", "HIGH"], example: "HIGH" },
                    riskScore:      { type: "integer", example: 90 },
                    reasons:        { type: "array",   items: { type: "string" } },
                    aiAnalysis:     { type: "string",  nullable: true, example: "Sustained heavy rainfall combined with high humidity..." },
                    recommendation: { type: "string",  nullable: true, example: "• Activate flood barriers\n• Evacuate low-lying areas" },
                    imageAnalysis:  { type: "string",  nullable: true, example: "Floodwater reaching door handles on residential street." },
                    floodSeverity:  { type: "string",  nullable: true, enum: ["NONE", "MINOR", "MODERATE", "SEVERE", "EXTREME"] },
                    confidence:     { type: "number",  nullable: true, minimum: 0, maximum: 1, example: 0.91 },
                    rescuePriority: { type: "string",  nullable: true, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"] },
                    temperature:    { type: "number",  example: 29.1 },
                    humidity:       { type: "integer", example: 92 },
                    rainfall:       { type: "number",  example: 55.0 },
                    windSpeed:      { type: "number",  example: 46.2 },
                    pressure:       { type: "number",  nullable: true, example: 991.0 },
                    locationName:   { type: "string",  example: "Kuala Lumpur" },
                    latitude:       { type: "number",  example: 3.147 },
                    longitude:      { type: "number",  example: 101.695 },
                    createdAt:      { type: "string",  format: "date-time" },
                    reportId:       { type: "integer", nullable: true, example: null },
                    user: {
                        type: "object",
                        properties: {
                            id:    { type: "integer" },
                            name:  { type: "string" },
                            email: { type: "string" },
                        },
                    },
                    report: {
                        nullable: true,
                        type: "object",
                        properties: {
                            id:          { type: "integer" },
                            description: { type: "string" },
                            address:     { type: "string" },
                            status:      { type: "string" },
                            severity:    { type: "string" },
                        },
                    },
                },
            },

            // ── Admin ─────────────────────────────────────────────────────────
            DashboardData: {
                type: "object",
                properties: {
                    totalUsers:        { type: "integer", example: 12 },
                    totalReports:      { type: "integer", example: 45 },
                    totalPredictions:  { type: "integer", example: 78 },
                    reportsByStatus: {
                        type: "object",
                        example: { PENDING: 20, REVIEWED: 10, RESOLVED: 12, DISMISSED: 3 },
                    },
                    predictionsByRisk: {
                        type: "object",
                        example: { LOW: 30, MEDIUM: 28, HIGH: 20 },
                    },
                },
            },
            AdminAction: {
                type: "object",
                properties: {
                    id:         { type: "integer", example: 1 },
                    action:     { type: "string",  example: "UPDATE_REPORT_STATUS" },
                    targetType: { type: "string",  example: "Report" },
                    targetId:   { type: "integer", example: 5 },
                    notes:      { type: "string",  nullable: true },
                    createdAt:  { type: "string",  format: "date-time" },
                    admin: {
                        type: "object",
                        properties: {
                            id:    { type: "integer" },
                            name:  { type: "string" },
                            email: { type: "string" },
                        },
                    },
                },
            },

            // ── Generic envelopes ─────────────────────────────────────────────
            Pagination: Pagination,
        },
    },

    // =========================================================================
    // PATHS
    // =========================================================================
    paths: {

        // ── Health ────────────────────────────────────────────────────────────
        "/health": {
            get: {
                tags:    ["Health"],
                summary: "Health check",
                responses: {
                    200: {
                        description: "API is running",
                        content: { "application/json": { schema: { type: "object", properties: {
                            success: { type: "boolean", example: true },
                            status:  { type: "string",  example: "Healthy" },
                            message: { type: "string",  example: "Flood Detection API is running" },
                        }}}},
                    },
                },
            },
        },

        // ── Auth ──────────────────────────────────────────────────────────────
        "/api/auth/register": {
            post: {
                tags:    ["Auth"],
                summary: "Register a new user",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/RegisterRequest" } } },
                },
                responses: {
                    201: { description: "User registered", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/UserPublic" }) } } },
                    409: { description: "Email already exists", content: { "application/json": { schema: ApiError } } },
                    422: { description: "Validation error",    content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/auth/login": {
            post: {
                tags:    ["Auth"],
                summary: "Login and receive a JWT",
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/LoginRequest" } } },
                },
                responses: {
                    200: { description: "Login successful", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/LoginData" }) } } },
                    401: { description: "Invalid credentials", content: { "application/json": { schema: ApiError } } },
                    422: { description: "Validation error",    content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/auth/profile": {
            get: {
                tags:     ["Auth"],
                summary:  "Get authenticated user profile",
                security: [BearerAuth],
                responses: {
                    200: { description: "Profile retrieved", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/UserPublic" }) } } },
                    401: { description: "Unauthorized",      content: { "application/json": { schema: ApiError } } },
                },
            },
        },

        // ── Weather ───────────────────────────────────────────────────────────
        "/api/weather": {
            get: {
                tags:    ["Weather"],
                summary: "Fetch current weather and flood risk for coordinates",
                description: "Calls Open-Meteo for live readings, reverse-geocodes via Nominatim, calculates rule-based flood risk, and persists a WeatherData record. Public — no auth required.",
                parameters: [
                    { in: "query", name: "lat", required: true,  schema: { type: "number" }, description: "Latitude (-90 to 90)",   example: 3.147 },
                    { in: "query", name: "lon", required: true,  schema: { type: "number" }, description: "Longitude (-180 to 180)", example: 101.695 },
                ],
                responses: {
                    200: { description: "Weather data with flood risk", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/WeatherCurrent" }) } } },
                    422: { description: "Invalid coordinates",          content: { "application/json": { schema: ApiError } } },
                    503: { description: "Weather provider unavailable", content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/weather/history": {
            get: {
                tags:        ["Weather"],
                summary:     "Paginated weather history",
                description: "Returns stored WeatherData records ordered newest-first. Optionally filtered by locationId. Public — no auth required.",
                parameters: [
                    PageParam,
                    LimitParam,
                    { in: "query", name: "locationId", schema: { type: "integer" }, description: "Filter by location ID" },
                ],
                responses: {
                    200: {
                        description: "Weather history",
                        content: { "application/json": { schema: ApiSuccess({
                            type: "object",
                            properties: {
                                records:    { type: "array", items: { $ref: "#/components/schemas/WeatherRecord" } },
                                pagination: { $ref: "#/components/schemas/Pagination" },
                            },
                        })}},
                    },
                },
            },
        },

        // ── Reports ───────────────────────────────────────────────────────────
        "/api/reports": {
            post: {
                tags:     ["Reports"],
                summary:  "Submit a flood report",
                security: [BearerAuth],
                description: "Creates a new flood report. Accepts `multipart/form-data` for optional image upload. Users see only their own reports; admins see all.",
                requestBody: {
                    required: true,
                    content: { "multipart/form-data": { schema: { $ref: "#/components/schemas/ReportCreateRequest" } } },
                },
                responses: {
                    201: { description: "Report created", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/Report" }) } } },
                    401: { description: "Unauthorized",   content: { "application/json": { schema: ApiError } } },
                    422: { description: "Validation error", content: { "application/json": { schema: ApiError } } },
                },
            },
            get: {
                tags:     ["Reports"],
                summary:  "List reports",
                security: [BearerAuth],
                description: "Returns paginated reports. Regular users see only their own. Admins see all. Filter by `status`.",
                parameters: [
                    PageParam,
                    LimitParam,
                    { in: "query", name: "status", schema: { type: "string", enum: ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"] } },
                ],
                responses: {
                    200: {
                        description: "Reports list",
                        content: { "application/json": { schema: ApiSuccess({
                            type: "object",
                            properties: {
                                reports:    { type: "array", items: { $ref: "#/components/schemas/Report" } },
                                pagination: { $ref: "#/components/schemas/Pagination" },
                            },
                        })}},
                    },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/reports/{id}": {
            get: {
                tags:     ["Reports"],
                summary:  "Get a single report",
                security: [BearerAuth],
                parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "Report found",   content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/Report" }) } } },
                    401: { description: "Unauthorized",   content: { "application/json": { schema: ApiError } } },
                    403: { description: "Access denied",  content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",      content: { "application/json": { schema: ApiError } } },
                },
            },
            delete: {
                tags:     ["Reports"],
                summary:  "Delete a report",
                security: [BearerAuth],
                description: "Users may delete their own reports. Admins may delete any. Image file is also removed from disk.",
                parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "Deleted",       content: { "application/json": { schema: ApiSuccess({ nullable: true, example: null }) } } },
                    401: { description: "Unauthorized",  content: { "application/json": { schema: ApiError } } },
                    403: { description: "Access denied", content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",     content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/reports/{id}/status": {
            patch: {
                tags:        ["Reports"],
                summary:     "Update report status (admin only)",
                security:    [BearerAuth],
                description: "Requires admin role. Updates the status and optionally the severity of a report.",
                parameters:  [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ReportStatusUpdateRequest" } } },
                },
                responses: {
                    200: { description: "Updated",       content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/Report" }) } } },
                    401: { description: "Unauthorized",  content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",   content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",     content: { "application/json": { schema: ApiError } } },
                    422: { description: "Validation error", content: { "application/json": { schema: ApiError } } },
                },
            },
        },

        // ── Predictions ───────────────────────────────────────────────────────
        "/api/predictions": {
            post: {
                tags:     ["Predictions"],
                summary:  "Run a flood prediction",
                security: [BearerAuth],
                description: [
                    "Runs the full AI prediction pipeline:",
                    "1. Fetch live weather (Open-Meteo + Nominatim)",
                    "2. Rule-based flood risk calculator",
                    "3. Gemini weather narrative analysis",
                    "4. Gemini vision image analysis *(only when an image is uploaded)*",
                    "5. Persist and return the full prediction record",
                    "",
                    "**Coordinates**: supply `lat`+`lon` as query params, **or** provide a `reportId`",
                    "whose report already has coordinates.",
                    "",
                    "HIGH-risk predictions automatically trigger an n8n webhook alert.",
                ].join("\n"),
                parameters: [
                    { in: "query", name: "lat", schema: { type: "number" }, description: "Latitude (-90 to 90)" },
                    { in: "query", name: "lon", schema: { type: "number" }, description: "Longitude (-180 to 180)" },
                ],
                requestBody: {
                    content: {
                        "multipart/form-data": {
                            schema: {
                                type: "object",
                                properties: {
                                    reportId: { type: "integer", description: "Link prediction to an existing report (optional)" },
                                    image:    { type: "string",  format: "binary", description: "Flood image for Gemini vision analysis (optional, JPEG/PNG/WebP, max 5 MB)" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: { description: "Prediction created", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/FloodPrediction" }) } } },
                    401: { description: "Unauthorized",       content: { "application/json": { schema: ApiError } } },
                    404: { description: "Report not found",   content: { "application/json": { schema: ApiError } } },
                    422: { description: "Coordinates required", content: { "application/json": { schema: ApiError } } },
                    503: { description: "Weather provider unavailable", content: { "application/json": { schema: ApiError } } },
                },
            },
            get: {
                tags:     ["Predictions"],
                summary:  "List prediction history",
                security: [BearerAuth],
                description: "Returns paginated prediction history. Regular users see only their own. Admins see all.",
                parameters: [
                    PageParam,
                    LimitParam,
                    { in: "query", name: "riskLevel", schema: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] } },
                    { in: "query", name: "reportId",  schema: { type: "integer" }, description: "Filter by linked report" },
                ],
                responses: {
                    200: {
                        description: "Predictions",
                        content: { "application/json": { schema: ApiSuccess({
                            type: "object",
                            properties: {
                                predictions: { type: "array", items: { $ref: "#/components/schemas/FloodPrediction" } },
                                pagination:  { $ref: "#/components/schemas/Pagination" },
                            },
                        })}},
                    },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/predictions/{id}": {
            get: {
                tags:     ["Predictions"],
                summary:  "Get a single prediction",
                security: [BearerAuth],
                parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "Prediction found", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/FloodPrediction" }) } } },
                    401: { description: "Unauthorized",     content: { "application/json": { schema: ApiError } } },
                    403: { description: "Access denied",    content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",        content: { "application/json": { schema: ApiError } } },
                },
            },
        },

        // ── Admin — Dashboard ─────────────────────────────────────────────────
        "/api/admin/dashboard": {
            get: {
                tags:        ["Admin — Dashboard"],
                summary:     "System statistics overview",
                security:    [BearerAuth],
                description: "Returns aggregate counts for users, reports, and predictions. Admin only.",
                responses: {
                    200: { description: "Dashboard data", content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/DashboardData" }) } } },
                    401: { description: "Unauthorized",   content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",    content: { "application/json": { schema: ApiError } } },
                },
            },
        },

        // ── Admin — Users ─────────────────────────────────────────────────────
        "/api/admin/users": {
            get: {
                tags:     ["Admin — Users"],
                summary:  "List all users",
                security: [BearerAuth],
                parameters: [
                    PageParam,
                    LimitParam,
                    { in: "query", name: "role",     schema: { type: "string", enum: ["user", "admin"] }, description: "Filter by role" },
                    { in: "query", name: "isActive", schema: { type: "string", enum: ["true", "false"] }, description: "Filter by active status" },
                ],
                responses: {
                    200: {
                        description: "Users list",
                        content: { "application/json": { schema: ApiSuccess({
                            type: "object",
                            properties: {
                                users:      { type: "array", items: { $ref: "#/components/schemas/UserPublic" } },
                                pagination: { $ref: "#/components/schemas/Pagination" },
                            },
                        })}},
                    },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",  content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/admin/users/{id}": {
            get: {
                tags:     ["Admin — Users"],
                summary:  "Get a single user",
                security: [BearerAuth],
                parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "User found",   content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/UserPublic" }) } } },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",  content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",    content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/admin/users/{id}/deactivate": {
            patch: {
                tags:        ["Admin — Users"],
                summary:     "Deactivate a user account",
                security:    [BearerAuth],
                description: "Sets `isActive = false`. The user will be rejected at login. Action is recorded in the audit log.",
                parameters:  [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { notes: { type: "string" } } } } },
                },
                responses: {
                    200: { description: "Deactivated",   content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/UserPublic" }) } } },
                    401: { description: "Unauthorized",  content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",   content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",     content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/admin/users/{id}/reactivate": {
            patch: {
                tags:        ["Admin — Users"],
                summary:     "Reactivate a user account",
                security:    [BearerAuth],
                description: "Sets `isActive = true`. Action is recorded in the audit log.",
                parameters:  [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                requestBody: {
                    content: { "application/json": { schema: { type: "object", properties: { notes: { type: "string" } } } } },
                },
                responses: {
                    200: { description: "Reactivated",  content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/UserPublic" }) } } },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",  content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",    content: { "application/json": { schema: ApiError } } },
                },
            },
        },

        // ── Admin — Reports ───────────────────────────────────────────────────
        "/api/admin/reports": {
            get: {
                tags:        ["Admin — Reports"],
                summary:     "List all reports (admin view)",
                security:    [BearerAuth],
                description: "Returns all reports across all users. Supports pagination and `status` filter.",
                parameters: [
                    PageParam,
                    LimitParam,
                    { in: "query", name: "status", schema: { type: "string", enum: ["PENDING", "REVIEWED", "RESOLVED", "DISMISSED"] } },
                ],
                responses: {
                    200: {
                        description: "Reports",
                        content: { "application/json": { schema: ApiSuccess({
                            type: "object",
                            properties: {
                                reports:    { type: "array", items: { $ref: "#/components/schemas/Report" } },
                                pagination: { $ref: "#/components/schemas/Pagination" },
                            },
                        })}},
                    },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",  content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/admin/reports/{id}": {
            get: {
                tags:     ["Admin — Reports"],
                summary:  "Get any report by ID",
                security: [BearerAuth],
                parameters: [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "Report found",  content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/Report" }) } } },
                    401: { description: "Unauthorized",  content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",   content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",     content: { "application/json": { schema: ApiError } } },
                },
            },
            delete: {
                tags:        ["Admin — Reports"],
                summary:     "Delete any report",
                security:    [BearerAuth],
                description: "Hard-deletes the report and its image file. Action is recorded in the audit log.",
                parameters:  [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                responses: {
                    200: { description: "Deleted",      content: { "application/json": { schema: ApiSuccess({ nullable: true, example: null }) } } },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",  content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",    content: { "application/json": { schema: ApiError } } },
                },
            },
        },
        "/api/admin/reports/{id}/status": {
            patch: {
                tags:        ["Admin — Reports"],
                summary:     "Update report status and severity",
                security:    [BearerAuth],
                description: "Updates the status and optionally the severity of any report. Action recorded in audit log.",
                parameters:  [{ in: "path", name: "id", required: true, schema: { type: "integer" } }],
                requestBody: {
                    required: true,
                    content: { "application/json": { schema: { $ref: "#/components/schemas/ReportStatusUpdateRequest" } } },
                },
                responses: {
                    200: { description: "Updated",       content: { "application/json": { schema: ApiSuccess({ $ref: "#/components/schemas/Report" }) } } },
                    401: { description: "Unauthorized",  content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",   content: { "application/json": { schema: ApiError } } },
                    404: { description: "Not found",     content: { "application/json": { schema: ApiError } } },
                    422: { description: "Validation error", content: { "application/json": { schema: ApiError } } },
                },
            },
        },

        // ── Admin — Predictions ───────────────────────────────────────────────
        "/api/admin/predictions": {
            get: {
                tags:        ["Admin — Predictions"],
                summary:     "List all predictions (admin view)",
                security:    [BearerAuth],
                description: "Returns predictions across all users. Filterable by `riskLevel`, `userId`, and `reportId`.",
                parameters: [
                    PageParam,
                    LimitParam,
                    { in: "query", name: "riskLevel", schema: { type: "string", enum: ["LOW", "MEDIUM", "HIGH"] } },
                    { in: "query", name: "userId",    schema: { type: "integer" }, description: "Filter by user" },
                    { in: "query", name: "reportId",  schema: { type: "integer" }, description: "Filter by linked report" },
                ],
                responses: {
                    200: {
                        description: "Predictions",
                        content: { "application/json": { schema: ApiSuccess({
                            type: "object",
                            properties: {
                                predictions: { type: "array", items: { $ref: "#/components/schemas/FloodPrediction" } },
                                pagination:  { $ref: "#/components/schemas/Pagination" },
                            },
                        })}},
                    },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",  content: { "application/json": { schema: ApiError } } },
                },
            },
        },

        // ── Admin — Audit log ─────────────────────────────────────────────────
        "/api/admin/audit": {
            get: {
                tags:        ["Admin — Audit"],
                summary:     "Admin action audit log",
                security:    [BearerAuth],
                description: "Returns all recorded admin actions, newest first. Filterable by `targetType`.",
                parameters: [
                    PageParam,
                    LimitParam,
                    { in: "query", name: "targetType", schema: { type: "string", enum: ["Report", "User"] }, description: "Filter by target entity type" },
                ],
                responses: {
                    200: {
                        description: "Audit log",
                        content: { "application/json": { schema: ApiSuccess({
                            type: "object",
                            properties: {
                                actions:    { type: "array", items: { $ref: "#/components/schemas/AdminAction" } },
                                pagination: { $ref: "#/components/schemas/Pagination" },
                            },
                        })}},
                    },
                    401: { description: "Unauthorized", content: { "application/json": { schema: ApiError } } },
                    403: { description: "Admins only",  content: { "application/json": { schema: ApiError } } },
                },
            },
        },
    },

    // Tag groups for sidebar ordering in Swagger UI
    tags: [
        { name: "Health",               description: "Service liveness" },
        { name: "Auth",                 description: "Registration, login, profile" },
        { name: "Weather",              description: "Live weather data and history" },
        { name: "Reports",              description: "User flood reports with image upload" },
        { name: "Predictions",          description: "AI-powered flood risk predictions" },
        { name: "Admin — Dashboard",    description: "System statistics" },
        { name: "Admin — Users",        description: "User management (admin only)" },
        { name: "Admin — Reports",      description: "Report management (admin only)" },
        { name: "Admin — Predictions",  description: "Prediction oversight (admin only)" },
        { name: "Admin — Audit",        description: "Admin action history" },
    ],
};

module.exports = swaggerSpec;
