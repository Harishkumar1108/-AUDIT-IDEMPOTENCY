"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const app_1 = require("./app");
Object.defineProperty(exports, "app", { enumerable: true, get: function () { return app_1.app; } });
const prisma_1 = require("./prisma");
const PORT = process.env.PORT || 3000;
const isServerless = process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV) ||
    Boolean(process.env.NOW_REGION) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
let server;
// 1. Conditional Port Listening: strictly executes only when running locally, never in serverless runtime
if (!isServerless && process.env.NODE_ENV !== 'production') {
    server = app_1.app.listen(PORT, () => {
        console.log(`🚀 Payment Idempotency Backend running on port ${PORT}`);
        console.log(`👉 Webhook endpoint: POST http://localhost:${PORT}/api/webhooks`);
        console.log(`👉 Health check:      GET  http://localhost:${PORT}/health`);
    });
    // Graceful shutdown
    const shutdown = async (signal) => {
        console.log(`\nReceived ${signal}. Shutting down gracefully...`);
        server?.close(async () => {
            await prisma_1.prisma.$disconnect();
            console.log('Prisma disconnected. Process terminated.');
            process.exit(0);
        });
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
// 2. Proper Serverless Export
exports.default = app_1.app;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = app_1.app;
    module.exports.default = app_1.app;
    module.exports.app = app_1.app;
}
