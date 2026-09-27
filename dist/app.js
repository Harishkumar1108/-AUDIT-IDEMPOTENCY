"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const webhook_1 = require("./routes/webhook");
const transactions_1 = require("./routes/transactions");
const chaos_1 = require("./routes/chaos");
const errorHandler_1 = require("./middleware/errorHandler");
const prisma_1 = require("./prisma");
const auditFeed_1 = require("./services/auditFeed");
const app = (0, express_1.default)();
exports.app = app;
// Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
// Serve React dashboard bundle from client/dist if present, else public
const clientDistPath = path_1.default.join(process.cwd(), 'client', 'dist');
if (fs_1.default.existsSync(clientDistPath)) {
    app.use(express_1.default.static(clientDistPath));
}
app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public')));
// Health check endpoint
app.get('/health', (_req, res) => {
    res.json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
});
// Reset Website Data endpoint: Clears transactions, events, idempotency keys & in-memory feed
app.all('/api/reset-data', async (_req, res, next) => {
    try {
        const [eventsDeleted, keysDeleted, txDeleted] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.event.deleteMany(),
            prisma_1.prisma.idempotencyKey.deleteMany(),
            prisma_1.prisma.transaction.deleteMany(),
        ]);
        (0, auditFeed_1.clearAuditFeed)();
        res.json({
            success: true,
            message: 'Ledger and event stream have been cleanly reset to fresh state.',
            deleted: {
                transactions: txDeleted.count,
                events: eventsDeleted.count,
                idempotencyKeys: keysDeleted.count,
            },
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        next(error);
    }
});
// Routes
app.use('/api/webhooks', webhook_1.webhookRouter);
app.use('/api/transactions', transactions_1.transactionRouter);
app.use('/api/simulate-chaos', chaos_1.chaosRouter);
// Global Error Handler
app.use(errorHandler_1.errorHandler);
// 1. Conditional Port Listening (executes only when running locally, never on Vercel/serverless)
const isServerless = process.env.VERCEL === '1' ||
    Boolean(process.env.VERCEL_ENV) ||
    Boolean(process.env.NOW_REGION) ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);
if (!isServerless && process.env.NODE_ENV !== 'production') {
    if (typeof require !== 'undefined' && require.main === module) {
        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`🚀 Payment Idempotency Backend running on port ${PORT}`);
            console.log(`👉 Webhook endpoint: POST http://localhost:${PORT}/api/webhooks`);
            console.log(`👉 Health check:      GET  http://localhost:${PORT}/health`);
        });
    }
}
// 2. Proper Serverless Export
exports.default = app;
// CommonJS export compatibility for Vercel serverless runtime
if (typeof module !== 'undefined' && module.exports) {
    module.exports = app;
    module.exports.default = app;
    module.exports.app = app;
}
