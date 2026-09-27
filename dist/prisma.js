"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
function sanitizeDatabaseUrl(rawUrl) {
    if (!rawUrl)
        return rawUrl;
    try {
        const match = rawUrl.match(/^(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@.+)$/);
        if (match) {
            const [, prefix, pass, suffix] = match;
            const safePass = encodeURIComponent(decodeURIComponent(pass));
            return `${prefix}${safePass}${suffix}`;
        }
    }
    catch {
        // If parsing fails, return rawUrl
    }
    return rawUrl;
}
const sanitizedUrl = sanitizeDatabaseUrl(process.env.DATABASE_URL);
if (sanitizedUrl && process.env.DATABASE_URL !== sanitizedUrl) {
    process.env.DATABASE_URL = sanitizedUrl;
}
const globalForPrisma = globalThis;
exports.prisma = globalForPrisma.prisma ??
    new client_1.PrismaClient({
        datasources: sanitizedUrl ? { db: { url: sanitizedUrl } } : undefined,
        log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
    });
if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = exports.prisma;
}
