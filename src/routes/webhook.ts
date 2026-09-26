import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { reconcileTransaction } from '../services/reconciliation';
import { addAuditFeedItem } from '../services/auditFeed';

export const webhookRouter = Router();

/**
 * POST /api/webhooks
 * 
 * Flow:
 * 1. Extract `event_id` from header ('Idempotency-Key') or body (`event_id` / `eventId`).
 * 2. Check IdempotencyKey table first.
 *    - If already exists: drop duplicate and return 200 OK immediately.
 * 3. In an atomic transaction:
 *    - Insert into IdempotencyKey (enforced by unique constraint on event_id).
 *    - Ensure or link Transaction (id, amount, initial status).
 *    - Create immutable Event log (event_id, transaction_id, payload JSONB).
 *    - Run State Reducer: read all historical events chronologically and reconcile master status.
 * 4. Catch race-condition P2002 unique constraint violations and drop with 200 OK.
 */
webhookRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const rawHeaderKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
    const headerKey = Array.isArray(rawHeaderKey) ? rawHeaderKey[0] : rawHeaderKey;
    const body = req.body || {};

    const eventId = (headerKey || body.event_id || body.eventId || body.id)?.toString()?.trim();

    if (!eventId) {
      res.status(400).json({
        error: 'Missing event identifier',
        message: 'Provide an `event_id` in the JSON body or an `Idempotency-Key` header.',
      });
      return;
    }

    const transactionData = body.data || body.transaction || {};
    const transactionId = (
      body.transaction_id ||
      body.transactionId ||
      transactionData.id ||
      transactionData.transaction_id
    )?.toString();

    const rawAmount = body.amount ?? transactionData.amount ?? 2499.0;
    const parsedAmount = new Prisma.Decimal(rawAmount);

    const customerName =
      body.customer?.name ||
      transactionData.customer?.name ||
      (typeof body.customer === 'string' ? body.customer : null) ||
      'Priya Patel';

    // Step 1: Pre-check IdempotencyKey table
    const existingKey = await prisma.idempotencyKey.findUnique({
      where: { eventId },
    });

    if (existingKey) {
      const existingEvent = await prisma.event.findFirst({
        where: { eventId },
        select: { transactionId: true },
      });
      const resolvedTxId = transactionId || existingEvent?.transactionId;

      addAuditFeedItem({
        eventId,
        transactionId: resolvedTxId,
        type: 'IDEMPOTENCY_DROPPED',
        badge: 'DROPPED',
        message: 'DROPPED — Duplicate event intercepted',
        amount: Number(parsedAmount),
        currency: 'INR',
        customer: customerName,
        payload: body,
      });

      res.status(200).json({
        success: true,
        status: 'DROPPED',
        result: 'duplicate',
        message: 'DROPPED — Duplicate event intercepted',
        event_id: eventId,
        first_seen_at: existingKey.createdAt,
      });
      return;
    }

    // Step 2: Atomic Database Write wrapped in safe try/catch
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Record idempotency key
        const idempotencyRecord = await tx.idempotencyKey.create({
          data: {
            eventId,
          },
        });

        // Resolve or create Transaction
        let transaction;
        if (transactionId) {
          transaction = await tx.transaction.findUnique({
            where: { id: transactionId },
          });

          if (!transaction) {
            transaction = await tx.transaction.create({
              data: {
                id: transactionId,
                amount: parsedAmount,
                status: 'PENDING',
              },
            });
          } else if (parsedAmount.greaterThan(0) && transaction.amount.equals(0)) {
            transaction = await tx.transaction.update({
              where: { id: transactionId },
              data: { amount: parsedAmount },
            });
          }
        } else {
          // If no specific transaction_id provided, create a new one
          transaction = await tx.transaction.create({
            data: {
              amount: parsedAmount,
              status: 'PENDING',
            },
          });
        }

        // Create immutable log in Event table (event_id, transaction_id, payload JSONB)
        const eventLog = await tx.event.create({
          data: {
            eventId,
            transactionId: transaction.id,
            payload: body,
          },
        });

        // Run State Reducer: Reconcile transaction master state chronologically
        const reconciliation = await reconcileTransaction(transaction.id, tx);

        return { idempotencyRecord, transaction, eventLog, reconciliation };
      });

      addAuditFeedItem({
        eventId,
        transactionId: result.transaction.id,
        type: result.reconciliation.hasConflict ? 'CONFLICT_DETECTED' : 'PROCESSED',
        badge: result.reconciliation.hasConflict ? 'CONFLICT' : 'LOGGED',
        message: result.reconciliation.hasConflict
          ? `CONFLICT — ${result.reconciliation.reason}`
          : `LOGGED — Unique event processed (master status: ${result.reconciliation.newStatus})`,
        amount: Number(result.transaction.amount),
        currency: 'INR',
        customer: customerName,
        payload: body,
      });

      res.status(200).json({
        success: true,
        status: 'success',
        message: 'Unique event logged and reconciled successfully.',
        event_id: eventId,
        transaction_id: result.transaction.id,
        transaction_status: result.reconciliation.newStatus,
        has_conflict: result.reconciliation.hasConflict,
        reconciliation_reason: result.reconciliation.reason,
        event_log_id: result.eventLog.id,
        event_count: result.reconciliation.eventCount,
        created_at: result.eventLog.createdAt,
      });
    } catch (txError: any) {
      // Step 3: Safe Idempotency Catching (Prisma P2002 unique constraint or duplicate key violation)
      const isUniqueConstraint =
        (txError instanceof Prisma.PrismaClientKnownRequestError && txError.code === 'P2002') ||
        txError?.code === 'P2002' ||
        txError?.message?.includes('P2002') ||
        txError?.message?.includes('Unique constraint') ||
        txError?.message?.includes('duplicate key');

      if (isUniqueConstraint) {
        addAuditFeedItem({
          eventId,
          transactionId,
          type: 'IDEMPOTENCY_DROPPED',
          badge: 'DROPPED',
          message: 'DROPPED — Duplicate event intercepted',
          amount: Number(parsedAmount),
          currency: 'INR',
          customer: customerName,
          payload: body,
        });

        // Gracefully catch duplicate key error: do not throw 500, return successful { success: true, status: 'DROPPED' }
        res.status(200).json({
          success: true,
          status: 'DROPPED',
          result: 'duplicate',
          message: 'DROPPED — Duplicate event intercepted',
          event_id: eventId,
        });
        return;
      }

      // If it's another unanticipated error, forward to error handler
      throw txError;
    }
  } catch (error) {
    next(error);
  }
});
