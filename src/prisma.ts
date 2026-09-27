import { PrismaClient } from '@prisma/client';

function sanitizeDatabaseUrl(rawUrl?: string): string | undefined {
  if (!rawUrl) return rawUrl;
  try {
    const match = rawUrl.match(/^(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)$/);
    if (match) {
      const [, prefix, pass, suffix] = match;
      const safePass = encodeURIComponent(decodeURIComponent(pass));
      return `${prefix}${safePass}${suffix}`;
    }
  } catch {
    // If parsing fails, return rawUrl
  }
  return rawUrl;
}

const sanitizedUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
if (sanitizedUrl && process.env.DATABASE_URL !== sanitizedUrl) {
  process.env.DATABASE_URL = sanitizedUrl;
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: sanitizedUrl ? { db: { url: sanitizedUrl } } : undefined,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

