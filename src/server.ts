import dotenv from 'dotenv';
dotenv.config();

import { app } from './app';
import { prisma } from './prisma';

const PORT = process.env.PORT || 3000;
const isServerless =
  process.env.VERCEL === '1' ||
  Boolean(process.env.VERCEL_ENV) ||
  Boolean(process.env.NOW_REGION) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

let server: any;

// 1. Conditional Port Listening: strictly executes only when running locally, never in serverless runtime
if (!isServerless && process.env.NODE_ENV !== 'production') {
  server = app.listen(PORT, () => {
    console.log(`🚀 Payment Idempotency Backend running on port ${PORT}`);
    console.log(`👉 Webhook endpoint: POST http://localhost:${PORT}/api/webhooks`);
    console.log(`👉 Health check:      GET  http://localhost:${PORT}/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);
    server?.close(async () => {
      await prisma.$disconnect();
      console.log('Prisma disconnected. Process terminated.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

// 2. Proper Serverless Export
export default app;
export { app };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = app;
  module.exports.default = app;
  module.exports.app = app;
}
