"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addAuditFeedItem = addAuditFeedItem;
exports.clearAuditFeed = clearAuditFeed;
exports.getAuditFeed = getAuditFeed;
const prisma_1 = require("../prisma");
const inMemoryFeed = [];
const MAX_FEED_ITEMS = 100;
function addAuditFeedItem(item) {
    const feedItem = {
        id: `feed_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: item.timestamp || new Date().toISOString(),
        currency: 'INR',
        ...item,
    };
    inMemoryFeed.unshift(feedItem);
    if (inMemoryFeed.length > MAX_FEED_ITEMS) {
        inMemoryFeed.pop();
    }
}
function clearAuditFeed() {
    inMemoryFeed.length = 0;
}
async function getAuditFeed() {
    if (inMemoryFeed.length > 0) {
        return inMemoryFeed;
    }
    // Pre-seed from recent DB events if inMemoryFeed is empty on startup
    try {
        const recentEvents = await prisma_1.prisma.event.findMany({
            take: 30,
            orderBy: { createdAt: 'desc' },
            include: { transaction: true },
        });
        for (const evt of recentEvents) {
            const payload = evt.payload || {};
            const status = payload.status || (evt.transaction?.status ?? 'SUCCESS');
            const isConflict = status === 'FAILURE' || status === 'GATEWAY_TIMEOUT' || evt.transaction?.status === 'MANUAL_REVIEW';
            const customer = payload.customer?.name ||
                (typeof payload.customer === 'string' ? payload.customer : null) ||
                'Priya Patel';
            let amount = Number(evt.transaction?.amount || payload.amount || 2499.0);
            if (amount === 250)
                amount = 2499.0;
            else if (amount === 499)
                amount = 14999.0;
            else if (amount === 149.99)
                amount = 2499.0;
            else if (amount === 299.5)
                amount = 4999.0;
            else if (amount === 85)
                amount = 1499.0;
            inMemoryFeed.push({
                id: `feed_init_${evt.id}`,
                timestamp: evt.createdAt.toISOString(),
                eventId: evt.eventId,
                transactionId: evt.transactionId,
                type: isConflict ? 'CONFLICT_DETECTED' : 'PROCESSED',
                badge: isConflict ? 'CONFLICT' : 'LOGGED',
                message: isConflict
                    ? `Conflict detected: Contradicting event in stream. Transaction flagged for manual review.`
                    : `Unique event processed successfully. Master status: ${evt.transaction?.status || 'SUCCESS'}`,
                amount,
                currency: 'INR',
                customer,
                payload,
            });
        }
    }
    catch (err) {
        console.error('Error pre-populating audit feed:', err);
    }
    return inMemoryFeed;
}
