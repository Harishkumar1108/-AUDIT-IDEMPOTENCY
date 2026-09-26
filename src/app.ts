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

export const app = express();

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
