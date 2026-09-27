"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractEventSignal = extractEventSignal;
exports.reduceTransactionState = reduceTransactionState;
exports.reconcileTransaction = reconcileTransaction;
const client_1 = require("@prisma/client");
const prisma_1 = require("../prisma");
/**
 * Normalizes an arbitrary event payload into an EventSignal.
 * Recognizes common payment gateway structures (Stripe, Razorpay, custom webhooks).
 */
function extractEventSignal(payload) {
    if (!payload || typeof payload !== 'object') {
        return 'UNKNOWN';
    }
    const rawStatus = (payload.status ||
        payload.event_type ||
        payload.type ||
        payload.data?.status ||
        payload.data?.object?.status ||
        payload.payment_status ||
        '').toString().toUpperCase();
    // Success signals
    if (rawStatus === 'SUCCESS' ||
        rawStatus === 'SUCCEEDED' ||
        rawStatus === 'PAYMENT.SUCCEEDED' ||
        rawStatus === 'CHARGE.SUCCEEDED' ||
        rawStatus === 'PAID') {
        return 'SUCCESS';
    }
    // Failure / Timeout / Error signals
    if (rawStatus === 'FAILURE' ||
        rawStatus === 'FAILED' ||
        rawStatus === 'TIMEOUT' ||
        rawStatus === 'GATEWAY_TIMEOUT' ||
        rawStatus === 'ERROR' ||
        rawStatus === 'PAYMENT.FAILED' ||
        rawStatus === 'PAYMENT.TIMEOUT' ||
        rawStatus === 'CANCELLED') {
        return 'FAILURE';
    }
    // Pending signals
    if (rawStatus === 'PENDING' ||
        rawStatus === 'INITIATED' ||
        rawStatus === 'PAYMENT.CREATED' ||
        rawStatus === 'PROCESSING') {
        return 'PENDING';
    }
    return 'UNKNOWN';
}
/**
 * State Reducer Logic:
 * Reads all historical events for a transaction chronologically and resolves the master state:
 *
 * 1. If conflicting signals occur (e.g. gateway timeout/failure log followed by delayed success,
 *    or a failure received after a success, or contradictory outcomes):
 *    -> Flags the transaction status as MANUAL_REVIEW.
 * 2. If any event in the stream shows a successful payment (SUCCESS) without contradictory signals:
 *    -> Resolves master status to SUCCESS.
 * 3. If only failure signals exist without any success:
 *    -> Can be flagged as MANUAL_REVIEW for human intervention.
 * 4. Otherwise:
 *    -> Defaults to PENDING.
 */
function reduceTransactionState(events) {
    if (!events || events.length === 0) {
        return {
            resolvedStatus: client_1.TransactionStatus.PENDING,
            hasConflict: false,
            signals: [],
            reason: 'No events logged for transaction yet.',
        };
    }
    // Sort events chronologically (oldest first)
    const sortedEvents = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    const signals = sortedEvents.map((evt) => extractEventSignal(evt.payload));
    const hasSuccess = signals.includes('SUCCESS');
    const hasFailure = signals.includes('FAILURE');
    // Rule 1: Conflicting signals (e.g. failure + success, out-of-order, or timeout followed by success)
    if (hasSuccess && hasFailure) {
        const successIndex = signals.indexOf('SUCCESS');
        const failureIndex = signals.indexOf('FAILURE');
        const pattern = failureIndex < successIndex
            ? 'Timeout/Failure followed by delayed Success'
            : 'Failure received after Success';
        return {
            resolvedStatus: client_1.TransactionStatus.MANUAL_REVIEW,
            hasConflict: true,
            signals,
            reason: `Conflicting signals detected in event stream (${pattern}). Flagged for manual review.`,
        };
    }
    // Rule 2: Uncontradicted Success
    if (hasSuccess) {
        return {
            resolvedStatus: client_1.TransactionStatus.SUCCESS,
            hasConflict: false,
            signals,
            reason: 'Transaction has confirmed SUCCESS event with no conflicting failure signals.',
        };
    }
    // Rule 3: Only failure signals recorded (no success)
    if (hasFailure) {
        return {
            resolvedStatus: client_1.TransactionStatus.MANUAL_REVIEW,
            hasConflict: true,
            signals,
            reason: 'Payment failure/timeout logged without successful recovery. Requires manual review.',
        };
    }
    // Rule 4: Default/Pending
    return {
        resolvedStatus: client_1.TransactionStatus.PENDING,
        hasConflict: false,
        signals,
        reason: 'Transaction is in pending state awaiting terminal payment confirmation.',
    };
}
/**
 * Reconciles the transaction master status by reading all historical events
 * from the database and applying the state reducer.
 *
 * Can be run within an existing Prisma transaction client or standalone.
 */
async function reconcileTransaction(transactionId, txClient) {
    const client = txClient || prisma_1.prisma;
    const transaction = await client.transaction.findUnique({
        where: { id: transactionId },
        include: {
            events: {
                orderBy: { createdAt: 'asc' },
            },
        },
    });
    if (!transaction) {
        throw new Error(`Transaction with ID "${transactionId}" not found for reconciliation.`);
    }
    const { resolvedStatus, hasConflict, reason } = reduceTransactionState(transaction.events);
    let updatedTransaction = transaction;
    if (transaction.status !== resolvedStatus) {
        updatedTransaction = await client.transaction.update({
            where: { id: transactionId },
            data: {
                status: resolvedStatus,
            },
            include: {
                events: true,
            },
        });
    }
    return {
        transactionId,
        previousStatus: transaction.status,
        newStatus: updatedTransaction.status,
        hasConflict,
        eventCount: transaction.events.length,
        reason,
    };
}
