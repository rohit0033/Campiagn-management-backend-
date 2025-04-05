"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const database_1 = __importDefault(require("./config/database"));
const campaign_routes_1 = __importDefault(require("./routes/campaign.routes"));
const personalized_message_routes_1 = __importDefault(require("./routes/personalized-message.routes"));
const error_middleware_1 = require("./middleware/error.middleware");
const rate_limit_middleware_1 = require("./middleware/rate-limit.middleware");
const leads_routes_1 = __importDefault(require("./routes/leads.routes"));
// Load environment variables
dotenv_1.default.config();
// Connect to MongoDB
(0, database_1.default)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Middleware
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Apply rate limiting
app.use('/api', rate_limit_middleware_1.apiLimiter);
app.use('/api/personalized-message/from-url', rate_limit_middleware_1.scrapingLimiter);
// Routes
app.use('/api/campaigns', campaign_routes_1.default);
app.use('/api/personalized-message', personalized_message_routes_1.default);
app.use('/api/leads', leads_routes_1.default);
// Provide a simple health check endpoint
app.get('/health', (_req, res) => {
    res.status(200).send('OK');
});
// 404 handler
app.use(error_middleware_1.notFound);
// Error handler
app.use(error_middleware_1.errorHandler);
// Start server
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
exports.default = app;
