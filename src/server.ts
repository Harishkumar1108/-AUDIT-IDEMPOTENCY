import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { prisma } from './prisma';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`🚀 Payment Idempotency Backend running on port ${PORT}`);
  console.log(`👉 Webhook endpoint: POST http://localhost:${PORT}/api/webhooks`);
  console.log(`👉 Health check:      GET  http://localhost:${PORT}/health`);
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    console.log('Prisma disconnected. Process terminated.');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
