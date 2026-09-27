import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { webhookRouter } from './routes/webhook';
import { transactionRouter } from './routes/transactions';
import { chaosRouter } from './routes/chaos';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './prisma';
import { clearAuditFeed } from './services/auditFeed';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve React dashboard bundle from client/dist if present, else public
const clientDistPath = path.join(process.cwd(), 'client', 'dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
}
app.use(express.static(path.join(process.cwd(), 'public')));

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
    const [eventsDeleted, keysDeleted, txDeleted] = await prisma.$transaction([
      prisma.event.deleteMany(),
      prisma.idempotencyKey.deleteMany(),
      prisma.transaction.deleteMany(),
    ]);

    clearAuditFeed();

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
  } catch (error) {
    next(error);
  }
});

// Routes
app.use('/api/webhooks', webhookRouter);
app.use('/api/transactions', transactionRouter);
app.use('/api/simulate-chaos', chaosRouter);

// Global Error Handler
app.use(errorHandler);

// 1. Conditional Port Listening (executes only when running locally, never on Vercel/serverless)
const isServerless =
  process.env.VERCEL === '1' ||
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
export default app;
export { app };

// CommonJS export compatibility for Vercel serverless runtime
if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
  module.exports.default = app;
  module.exports.app = app;
}
