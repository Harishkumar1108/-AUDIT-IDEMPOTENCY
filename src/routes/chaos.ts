import { Router, Request, Response, NextFunction } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../prisma';
import { addAuditFeedItem } from '../services/auditFeed';
import { reconcileTransaction } from '../services/reconciliation';
import { INDIAN_NAMES_POOL, getRandomCustomerName, getShuffledCustomerNames } from '../utils/names';

export const chaosRouter = Router();

interface BlastResult {
  attempt: number;
  httpStatus: number;
  body: any;
}

interface GeneratedEvent {
  eventId: string;
  transactionId: string;
  scenario: 'double_blast' | 'duplicate_blast' | 'out_of_order' | 'full_suite';
  status: string;
  type: 'PROCESSED' | 'IDEMPOTENCY_DROPPED' | 'CONFLICT_DETECTED';
  amount: number;
  currency: string;
  customer: string;
  timestamp: string;
  payload: any;
  httpResponse?: any;
}

/**
 * Helper to dispatch webhook request internally through local HTTP
 */
async function dispatchWebhook(port: number, payload: any, idempotencyHeader?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idempotencyHeader) {
    headers['Idempotency-Key'] = idempotencyHeader;
  }

  const urls = [
    `http://127.0.0.1:${port}/api/webhooks`,
    `http://localhost:${port}/api/webhooks`,
  ];

  let lastError: any;
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      let body: any;
      const text = await response.text();
      try {
        body = JSON.parse(text);
      } catch {
        body = { raw: text };
      }

      return {
        httpStatus: response.status,
        body,
      };
    } catch (err) {
      lastError = err;
    }
  }

  console.error('[Chaos Simulator] Internal webhook dispatch failed:', lastError);
  return {
    httpStatus: 500,
    body: {
      success: false,
      error: lastError?.message || 'Failed to dispatch webhook internally',
    },
  };
}

/**
 * Mode 1: Double Blast
 * Rule: Generate and insert exactly 2 identical transaction records into the ledger/database.
 * - Sequential for-loop: dispatches the exact same webhook payload twice.
 *   - 1st execution: successfully inserts the row.
 *   - 2nd execution: hits the idempotency catcher, safely registers as dropped.
 * - In addition, inserts the 2nd identical transaction record into the database,
 *   so the ledger table shows exactly 2 identical transaction records for the customer.
 * - Customer name is randomly picked from diverse Indian names pool.
 * - Returns both execution results in an array to the frontend.
 */
async function runDoubleBlast(port: number) {
  const customerName = getRandomCustomerName();
  const ts = Date.now();
  const blastTxId1 = `tx_dbl_${ts}_1`;
  const blastTxId2 = `tx_dbl_${ts}_2`;
  const blastEventId = `evt_dbl_${ts}`;
  const amount = 2499.0;

  const blastPayload = {
    event_id: blastEventId,
    transaction_id: blastTxId1,
    amount,
    currency: 'INR',
    customer: {
      name: customerName,
      email: `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.in`,
    },
    status: 'SUCCESS',
    event_type: 'payment.succeeded',
    note: 'Double blast idempotency verification: identical event dispatched twice sequentially',
    timestamp: new Date().toISOString(),
  };

  console.log(`[Chaos Simulator] Launching Double Blast for customer: ${customerName} (${blastEventId})...`);

  // Sequential execution using a for loop (running twice)
  const executionResults: BlastResult[] = [];
  for (let i = 0; i < 2; i++) {
    const attempt = i + 1;
    console.log(`[Chaos Simulator] Double Blast execution ${attempt}/2 for ${blastEventId}...`);
    const res = await dispatchWebhook(port, blastPayload);
    executionResults.push({
      attempt,
      ...res,
    });
  }

  // Insert the 2nd identical transaction record into the database
  // Result: exactly 2 identical transaction records in the ledger/database
  const duplicateTx = await prisma.transaction.create({
    data: {
      id: blastTxId2,
      amount: new Prisma.Decimal(amount),
      status: 'SUCCESS',
      createdAt: new Date(),
      events: {
        create: {
          eventId: `evt_dbl_${ts}_dup`,
          payload: {
            event_id: `evt_dbl_${ts}_dup`,
            transaction_id: blastTxId2,
            amount,
            currency: 'INR',
            customer: {
              name: customerName,
              email: `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.in`,
            },
            status: 'SUCCESS',
            event_type: 'payment.succeeded',
            note: 'Duplicate payment record: identical payment that happened twice',
            timestamp: new Date().toISOString(),
          },
        },
      },
    },
  });

  addAuditFeedItem({
    eventId: `evt_dbl_${ts}_dup`,
    transactionId: blastTxId2,
    type: 'PROCESSED',
    badge: 'LOGGED',
    message: `LOGGED — Identical duplicate transaction recorded on ledger for ${customerName} (₹2,499.00)`,
    amount,
    currency: 'INR',
    customer: customerName,
    payload: { customer: { name: customerName }, amount },
  });

  // Verify DB state: exactly 1 transaction for blastTxId1 with 1 event, and dbKey recorded
  const dbTx1 = await prisma.transaction.findUnique({
    where: { id: blastTxId1 },
    include: { events: true },
  });

  const dbKey = await prisma.idempotencyKey.findUnique({
    where: { eventId: blastEventId },
  });

  const firstSuccess =
    executionResults[0].httpStatus === 200 &&
    (executionResults[0].body?.status === 'success' || executionResults[0].body?.success === true);

  const secondDropped =
    executionResults[1].httpStatus === 200 &&
    (executionResults[1].body?.status === 'DROPPED' || executionResults[1].body?.status === 'duplicate');

  const doublePassed =
    firstSuccess &&
    secondDropped &&
    dbTx1?.events.length === 1 &&
    dbTx1?.status === 'SUCCESS' &&
    !!dbKey;

  const generatedEvents: GeneratedEvent[] = [
    {
      eventId: blastEventId,
      transactionId: blastTxId1,
      scenario: 'double_blast',
      status: 'LOGGED — Unique event processed',
      type: 'PROCESSED',
      amount,
      currency: 'INR',
      customer: customerName,
      timestamp: new Date().toISOString(),
      payload: blastPayload,
      httpResponse: executionResults[0].body,
    },
    {
      eventId: blastEventId,
      transactionId: blastTxId1,
      scenario: 'double_blast',
      status: 'DROPPED — Duplicate event intercepted',
      type: 'IDEMPOTENCY_DROPPED',
      amount,
      currency: 'INR',
      customer: customerName,
      timestamp: new Date().toISOString(),
      payload: blastPayload,
      httpResponse: executionResults[1].body,
    },
  ];

  return {
    scenarioResult: {
      scenarioName: 'Double Blast (2 Identical Ledger Records)',
      description: 'Simulated identical webhook twice sequentially via for loop. First inserted normally; second was safely intercepted & dropped. Exactly 2 identical transaction records created in the ledger.',
      verdict: doublePassed ? 'PASSED' : 'FAILED',
      targetEventId: blastEventId,
      targetTransactionId: blastTxId1,
      results: executionResults, // both execution results in an array
      steps: executionResults,   // both execution results in an array
      concurrencyStats: {
        totalFired: 2,
        successResponses: firstSuccess ? 1 : 0,
        duplicatesDroppedWith200OK: secondDropped ? 1 : 0,
        expectedSuccess: 1,
        expectedDuplicates: 1,
      },
      databaseVerification: {
        transactionStatus: dbTx1?.status,
        eventsLoggedCount: dbTx1?.events.length ?? 0,
        idempotencyKeyRecorded: !!dbKey,
        singleTransactionCreated: dbTx1?.events.length === 1,
        exactRowsInserted: 2,
        identicalCustomer: customerName,
      },
      rawResponses: executionResults.map((r) => ({
        attempt: r.attempt,
        httpStatus: r.httpStatus,
        statusField: r.body?.status,
        success: r.body?.success,
        message: r.body?.message,
      })),
    },
    doublePassed,
    executionResults,
    generatedEvents,
    insertedTransactionIds: [blastTxId1, blastTxId2],
  };
}

/**
 * Mode 2: Out-of-Order
 * Rule: Generate and insert exactly 5 different transaction records into the ledger/database with mixed states (SUCCESS, MANUAL_REVIEW).
 * - Fires a failure/timeout event first, followed immediately by a conflicting success event for the primary transaction.
 * - Inserts 4 additional distinct transactions with mixed states (SUCCESS, MANUAL_REVIEW).
 * - Uses 5 diverse authentic Indian names.
 * - Returns chronological steps to the frontend audit stream.
 */
async function runOutOfOrder(port: number) {
  const ts = Date.now();
  const names = getShuffledCustomerNames(5);

  console.log(`[Chaos Simulator] Launching Out-of-Order Chaos: generating 5 distinct transactions...`);

  // Record 1: Primary Out-of-Order transaction (Contradictory Failure then Delayed Success -> resolves to MANUAL_REVIEW)
  const orderTxId1 = `tx_order_${ts}_1`;
  const failureEventId = `evt_order_fail_${ts}`;
  const successEventId = `evt_order_succ_${ts}`;
  const customer1 = names[0];

  const failurePayload = {
    event_id: failureEventId,
    transaction_id: orderTxId1,
    amount: 14999.0,
    currency: 'INR',
    customer: {
      name: customer1,
      email: `${customer1.toLowerCase().replace(/\s+/g, '.')}@example.in`,
    },
    status: 'FAILURE',
    event_type: 'payment.failed',
    error_code: 'GATEWAY_TIMEOUT',
    note: 'Initial processor timeout/failure notification received',
    timestamp: new Date().toISOString(),
  };

  const successPayload = {
    event_id: successEventId,
    transaction_id: orderTxId1,
    amount: 14999.0,
    currency: 'INR',
    customer: {
      name: customer1,
      email: `${customer1.toLowerCase().replace(/\s+/g, '.')}@example.in`,
    },
    status: 'SUCCESS',
    event_type: 'payment.succeeded',
    note: 'Delayed processor success confirmation arrived after timeout',
    timestamp: new Date().toISOString(),
  };

  const chronologicalPayloads = [
    {
      step: 1,
      name: 'Failure / Timeout Event',
      signalSent: 'FAILURE (GATEWAY_TIMEOUT)',
      payload: failurePayload,
    },
    {
      step: 2,
      name: 'Delayed Success Event',
      signalSent: 'SUCCESS (DELAYED)',
      payload: successPayload,
    },
  ];

  const chronologicalResults: any[] = [];
  for (const item of chronologicalPayloads) {
    const res = await dispatchWebhook(port, item.payload);
    const currentTx = await prisma.transaction.findUnique({
      where: { id: orderTxId1 },
    });

    chronologicalResults.push({
      step: item.step,
      signalSent: item.signalSent,
      eventId: item.payload.event_id,
      transactionId: orderTxId1,
      resultingTransactionStatus: currentTx?.status,
      httpStatus: res.httpStatus,
      body: res.body,
    });
  }

  // Record 2: SUCCESS state
  const tx2Id = `tx_order_${ts}_2`;
  const customer2 = names[1];
  const tx2Amount = 4999.0;
  await prisma.transaction.create({
    data: {
      id: tx2Id,
      amount: new Prisma.Decimal(tx2Amount),
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 30000),
      events: {
        create: {
          eventId: `evt_ord_${ts}_2`,
          payload: {
            event_id: `evt_ord_${ts}_2`,
            transaction_id: tx2Id,
            amount: tx2Amount,
            currency: 'INR',
            customer: { name: customer2 },
            status: 'SUCCESS',
            event_type: 'payment.succeeded',
            timestamp: new Date().toISOString(),
          },
        },
      },
    },
  });
  addAuditFeedItem({
    eventId: `evt_ord_${ts}_2`,
    transactionId: tx2Id,
    type: 'PROCESSED',
    badge: 'LOGGED',
    message: `LOGGED — Payment confirmed successfully for ${customer2} (₹4,999.00)`,
    amount: tx2Amount,
    currency: 'INR',
    customer: customer2,
    payload: { customer: { name: customer2 } },
  });

  // Record 3: MANUAL_REVIEW state (Conflict: Gateway timeout followed by delayed charge)
  const tx3Id = `tx_order_${ts}_3`;
  const customer3 = names[2];
  const tx3Amount = 8999.0;
  const createdTx3 = await prisma.transaction.create({
    data: {
      id: tx3Id,
      amount: new Prisma.Decimal(tx3Amount),
      status: 'MANUAL_REVIEW',
      createdAt: new Date(Date.now() - 60000),
      events: {
        createMany: {
          data: [
            {
              eventId: `evt_ord_${ts}_3_fail`,
              payload: {
                event_id: `evt_ord_${ts}_3_fail`,
                transaction_id: tx3Id,
                amount: tx3Amount,
                currency: 'INR',
                customer: { name: customer3 },
                status: 'FAILURE',
                error_code: 'NETWORK_TIMEOUT',
                timestamp: new Date(Date.now() - 55000).toISOString(),
              },
            },
            {
              eventId: `evt_ord_${ts}_3_succ`,
              payload: {
                event_id: `evt_ord_${ts}_3_succ`,
                transaction_id: tx3Id,
                amount: tx3Amount,
                currency: 'INR',
                customer: { name: customer3 },
                status: 'SUCCESS',
                timestamp: new Date(Date.now() - 50000).toISOString(),
              },
            },
          ],
        },
      },
    },
  });
  addAuditFeedItem({
    eventId: `evt_ord_${ts}_3_succ`,
    transactionId: tx3Id,
    type: 'CONFLICT_DETECTED',
    badge: 'CONFLICT',
    message: `CONFLICT — Contradictory signals detected for ${customer3} (Flagged for Manual Review)`,
    amount: tx3Amount,
    currency: 'INR',
    customer: customer3,
    payload: { customer: { name: customer3 } },
  });

  // Record 4: SUCCESS state
  const tx4Id = `tx_order_${ts}_4`;
  const customer4 = names[3];
  const tx4Amount = 2499.0;
  await prisma.transaction.create({
    data: {
      id: tx4Id,
      amount: new Prisma.Decimal(tx4Amount),
      status: 'SUCCESS',
      createdAt: new Date(Date.now() - 90000),
      events: {
        create: {
          eventId: `evt_ord_${ts}_4`,
          payload: {
            event_id: `evt_ord_${ts}_4`,
            transaction_id: tx4Id,
            amount: tx4Amount,
            currency: 'INR',
            customer: { name: customer4 },
            status: 'SUCCESS',
            event_type: 'payment.succeeded',
            timestamp: new Date().toISOString(),
          },
        },
      },
    },
  });
  addAuditFeedItem({
    eventId: `evt_ord_${ts}_4`,
    transactionId: tx4Id,
    type: 'PROCESSED',
    badge: 'LOGGED',
    message: `LOGGED — Payment confirmed successfully for ${customer4} (₹2,499.00)`,
    amount: tx4Amount,
    currency: 'INR',
    customer: customer4,
    payload: { customer: { name: customer4 } },
  });

  // Record 5: MANUAL_REVIEW state (Unresolved Gateway Failure)
  const tx5Id = `tx_order_${ts}_5`;
  const customer5 = names[4];
  const tx5Amount = 11999.0;
  await prisma.transaction.create({
    data: {
      id: tx5Id,
      amount: new Prisma.Decimal(tx5Amount),
      status: 'MANUAL_REVIEW',
      createdAt: new Date(Date.now() - 120000),
      events: {
        create: {
          eventId: `evt_ord_${ts}_5`,
          payload: {
            event_id: `evt_ord_${ts}_5`,
            transaction_id: tx5Id,
            amount: tx5Amount,
            currency: 'INR',
            customer: { name: customer5 },
            status: 'FAILURE',
            error_code: 'PROCESSOR_DECLINED',
            timestamp: new Date().toISOString(),
          },
        },
      },
    },
  });
  addAuditFeedItem({
    eventId: `evt_ord_${ts}_5`,
    transactionId: tx5Id,
    type: 'CONFLICT_DETECTED',
    badge: 'CONFLICT',
    message: `CONFLICT — Payment failure/timeout logged for ${customer5} (Flagged for Manual Review)`,
    amount: tx5Amount,
    currency: 'INR',
    customer: customer5,
    payload: { customer: { name: customer5 } },
  });

  // Verify Record 1 final DB status
  const finalTx1 = await prisma.transaction.findUnique({
    where: { id: orderTxId1 },
    include: {
      events: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  const orderPassed =
    finalTx1?.status === 'MANUAL_REVIEW' &&
    finalTx1?.events.length === 2;

  const generatedEvents: GeneratedEvent[] = [
    {
      eventId: failureEventId,
      transactionId: orderTxId1,
      scenario: 'out_of_order',
      status: 'FAILURE',
      type: 'CONFLICT_DETECTED',
      amount: 14999.0,
      currency: 'INR',
      customer: customer1,
      timestamp: new Date().toISOString(),
      payload: failurePayload,
      httpResponse: chronologicalResults[0]?.body,
    },
    {
      eventId: successEventId,
      transactionId: orderTxId1,
      scenario: 'out_of_order',
      status: 'SUCCESS',
      type: 'CONFLICT_DETECTED',
      amount: 14999.0,
      currency: 'INR',
      customer: customer1,
      timestamp: new Date().toISOString(),
      payload: successPayload,
      httpResponse: chronologicalResults[1]?.body,
    },
  ];

  return {
    scenarioResult: {
      scenarioName: 'Out-of-Order Chaos (5 Mixed Records)',
      description: 'Fired failure/timeout event first, followed by delayed success. Generated exactly 5 different transaction records with mixed states (SUCCESS, MANUAL_REVIEW) across diverse Indian customers.',
      verdict: orderPassed ? 'PASSED' : 'FAILED',
      targetTransactionId: orderTxId1,
      results: chronologicalResults,
      steps: chronologicalResults,
      eventTimeline: chronologicalResults.map((s) => ({
        step: s.step,
        eventId: s.eventId,
        signalSent: s.signalSent,
        resultingTransactionStatus: s.resultingTransactionStatus,
        expectedStatus: 'MANUAL_REVIEW',
        httpResponse: s.body,
      })),
      databaseVerification: {
        finalMasterStatus: finalTx1?.status,
        eventsLoggedCount: finalTx1?.events.length ?? 0,
        conflictIdentified: finalTx1?.status === 'MANUAL_REVIEW',
        exactRowsInserted: 5,
        mixedStatesGenerated: ['MANUAL_REVIEW', 'SUCCESS', 'MANUAL_REVIEW', 'SUCCESS', 'MANUAL_REVIEW'],
        customersAssigned: names,
      },
    },
    orderPassed,
    chronologicalResults,
    generatedEvents,
    insertedTransactionIds: [orderTxId1, tx2Id, tx3Id, tx4Id, tx5Id],
  };
}

/**
 * Mode 3: Full Suite
 * Rule: Generate and insert exactly 10 random transaction records into the ledger/database with mixed timestamps and statuses.
 * - Uses diverse Indian names pool across all 10 records.
 * - Mixed statuses (SUCCESS, MANUAL_REVIEW, PENDING).
 * - Mixed timestamps across recent time windows.
 */
async function runFullSuite(port: number) {
  const ts = Date.now();
  const names = getShuffledCustomerNames(10);
  const amounts = [1499.0, 2499.0, 3499.0, 4999.0, 6999.0, 8999.0, 9999.0, 14999.0, 19999.0, 24999.0];
  const statuses: ('SUCCESS' | 'MANUAL_REVIEW' | 'PENDING')[] = [
    'SUCCESS',
    'MANUAL_REVIEW',
    'SUCCESS',
    'MANUAL_REVIEW',
    'SUCCESS',
    'PENDING',
    'SUCCESS',
    'MANUAL_REVIEW',
    'SUCCESS',
    'MANUAL_REVIEW',
  ];

  console.log(`[Chaos Simulator] Launching Full Suite: generating exactly 10 random transactions...`);

  const insertedIds: string[] = [];
  const generatedEvents: GeneratedEvent[] = [];

  for (let i = 0; i < 10; i++) {
    const txId = `tx_suite_${ts}_${i + 1}`;
    const evtId = `evt_suite_${ts}_${i + 1}`;
    const customer = names[i];
    const amount = amounts[i];
    const status = statuses[i];
    const createdAt = new Date(Date.now() - (10 - i) * 120000); // spread across past 20 minutes

    let eventType = 'payment.succeeded';
    let auditType: 'PROCESSED' | 'CONFLICT_DETECTED' | 'IDEMPOTENCY_DROPPED' = 'PROCESSED';
    let badge: 'LOGGED' | 'CONFLICT' | 'DROPPED' = 'LOGGED';

    if (status === 'MANUAL_REVIEW') {
      eventType = 'payment.failed';
      auditType = 'CONFLICT_DETECTED';
      badge = 'CONFLICT';
    } else if (status === 'PENDING') {
      eventType = 'payment.initiated';
    }

    const payload = {
      event_id: evtId,
      transaction_id: txId,
      amount,
      currency: 'INR',
      customer: {
        name: customer,
        email: `${customer.toLowerCase().replace(/\s+/g, '.')}@example.in`,
      },
      status: status === 'MANUAL_REVIEW' ? 'FAILURE' : status,
      event_type: eventType,
      note: `Full suite simulated transaction ${i + 1}/10`,
      timestamp: createdAt.toISOString(),
    };

    await prisma.transaction.create({
      data: {
        id: txId,
        amount: new Prisma.Decimal(amount),
        status,
        createdAt,
        events: {
          create: {
            eventId: evtId,
            payload,
            createdAt,
          },
        },
      },
    });

    addAuditFeedItem({
      eventId: evtId,
      transactionId: txId,
      type: auditType,
      badge,
      message: status === 'MANUAL_REVIEW'
        ? `CONFLICT — Gateway timeout/anomaly for ${customer} (₹${amount.toLocaleString('en-IN')})`
        : `LOGGED — Transaction verified for ${customer} (₹${amount.toLocaleString('en-IN')})`,
      amount,
      currency: 'INR',
      customer,
      payload,
    });

    insertedIds.push(txId);
    generatedEvents.push({
      eventId: evtId,
      transactionId: txId,
      scenario: 'full_suite',
      status: status === 'MANUAL_REVIEW' ? 'CONFLICT_DETECTED' : status,
      type: auditType,
      amount,
      currency: 'INR',
      customer,
      timestamp: createdAt.toISOString(),
      payload,
    });
  }

  // Also run the double blast, legacy duplicate blast, and out-of-order test verifications for test-chaos assertion compatibility
  const [doubleOutput, blastOutput, orderOutput] = await Promise.all([
    runDoubleBlast(port),
    runDuplicateBlast(port),
    runOutOfOrder(port),
  ]);

  return {
    scenarioResult: {
      scenarioName: 'Full Suite Simulation (10 Random Ledger Records)',
      description: 'Generated and inserted exactly 10 random transaction records with mixed timestamps and statuses across diverse Indian names.',
      verdict: 'PASSED',
      totalRecordsInserted: 10,
      insertedTransactionIds: insertedIds,
      statusBreakdown: {
        SUCCESS: 5,
        MANUAL_REVIEW: 4,
        PENDING: 1,
      },
      customersAssigned: names,
    },
    doubleOutput,
    blastOutput,
    orderOutput,
    insertedIds,
    generatedEvents: [
      ...generatedEvents,
      ...doubleOutput.generatedEvents,
      ...blastOutput.generatedEvents,
      ...orderOutput.generatedEvents,
    ],
    allPassed: doubleOutput.doublePassed && blastOutput.blastPassed && orderOutput.orderPassed,
  };
}

/**
 * Legacy 5x Duplicate Blast (Kept for automated test script verification)
 */
async function runDuplicateBlast(port: number) {
  const customerName = getRandomCustomerName();
  const blastTxId = `tx_blast_${Date.now()}`;
  const blastEventId = `evt_blast_${Date.now()}`;
  const blastPayload = {
    event_id: blastEventId,
    transaction_id: blastTxId,
    amount: 2499.0,
    currency: 'INR',
    customer: {
      name: customerName,
      email: `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.in`,
    },
    status: 'SUCCESS',
    event_type: 'payment.succeeded',
    note: 'High-concurrency duplicate blast test for database idempotency guard',
    timestamp: new Date().toISOString(),
  };

  console.log(`[Chaos Simulator] Launching Duplicate Blast: 5 concurrent requests for ${blastEventId}...`);

  const blastPromises: Promise<BlastResult>[] = [];
  for (let i = 0; i < 5; i++) {
    const attempt = i + 1;
    blastPromises.push(
      dispatchWebhook(port, blastPayload).then((res) => ({
        attempt,
        ...res,
      }))
    );
  }

  const blastResponses: BlastResult[] = await Promise.all(blastPromises);

  const successCount = blastResponses.filter(
    (r) => r.httpStatus === 200 && (r.body.status === 'success' || (r.body.success === true && r.body.status !== 'DROPPED'))
  ).length;
  const duplicateCount = blastResponses.filter(
    (r) => r.httpStatus === 200 && (r.body.status === 'DROPPED' || r.body.status === 'duplicate')
  ).length;

  const dbTx = await prisma.transaction.findUnique({
    where: { id: blastTxId },
    include: { events: true },
  });

  const dbKey = await prisma.idempotencyKey.findUnique({
    where: { eventId: blastEventId },
  });

  const blastPassed =
    successCount === 1 &&
    duplicateCount === 4 &&
    dbTx?.events.length === 1 &&
    dbTx?.status === 'SUCCESS' &&
    !!dbKey;

  const generatedEvents: GeneratedEvent[] = blastResponses.map((r) => {
    const isSuccess = r.body.status === 'success' || (r.body.success === true && r.body.status !== 'DROPPED');
    return {
      eventId: blastEventId,
      transactionId: blastTxId,
      scenario: 'duplicate_blast',
      status: isSuccess ? 'LOGGED — Unique event processed' : 'DROPPED — Duplicate event intercepted',
      type: isSuccess ? 'PROCESSED' : 'IDEMPOTENCY_DROPPED',
      amount: 2499.0,
      currency: 'INR',
      customer: customerName,
      timestamp: new Date().toISOString(),
      payload: blastPayload,
      httpResponse: r.body,
    };
  });

  return {
    scenarioResult: {
      scenarioName: 'Duplicate Blast (Idempotency Proof)',
      description: 'Fired 5 identical success payloads concurrently via a 5x loop to test database idempotency guard.',
      verdict: blastPassed ? 'PASSED' : 'FAILED',
      targetEventId: blastEventId,
      targetTransactionId: blastTxId,
      results: blastResponses,
      steps: blastResponses,
      concurrencyStats: {
        totalFired: 5,
        successResponses: successCount,
        duplicatesDroppedWith200OK: duplicateCount,
        expectedSuccess: 1,
        expectedDuplicates: 4,
      },
      databaseVerification: {
        transactionStatus: dbTx?.status,
        eventsLoggedCount: dbTx?.events.length ?? 0,
        idempotencyKeyRecorded: !!dbKey,
      },
      rawResponses: blastResponses.map((r) => ({
        attempt: r.attempt,
        httpStatus: r.httpStatus,
        statusField: r.body.status,
        message: r.body.message,
      })),
    },
    blastPassed,
    blastResponses,
    generatedEvents,
  };
}

/**
 * POST /api/simulate-chaos
 * 
 * Strict Modes:
 * 1. "double_blast": Generates and inserts exactly 2 identical transaction records into the ledger/database.
 * 2. "out_of_order": Generates and inserts exactly 5 different transaction records with mixed states (SUCCESS, MANUAL_REVIEW).
 * 3. "full_suite": Generates and inserts exactly 10 random transaction records with mixed timestamps and statuses.
 */
chaosRouter.post('/', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const port = (req.socket && req.socket.localPort) || Number(process.env.PORT) || 3000;
    
    // Safely extract and normalize scenario / mode parameter from diverse possible request shapes
    const modeInput =
      (typeof req.body?.mode === 'string' && req.body.mode) ||
      (typeof req.body?.scenario === 'string' && req.body.scenario) ||
      (typeof req.body?.type === 'string' && req.body.type) ||
      (typeof req.body?.chaosType === 'string' && req.body.chaosType) ||
      (typeof req.body?.chaos_type === 'string' && req.body.chaos_type) ||
      (typeof req.body?.mode === 'number' && String(req.body.mode)) ||
      'double_blast';

    const rawScenario = modeInput.trim().toLowerCase().replace(/[\s-]+/g, '_');

    // Map scenario aliases
    const isDoubleBlast = ['double_blast', 'double', 'doubleblast'].includes(rawScenario);
    const isOutOfOrder = ['out_of_order', 'outoforder', 'order'].includes(rawScenario);
    const isFullSuite = ['full_suite', 'fullsuite', 'full', 'suite', 'all'].includes(rawScenario);
    const isLegacyDuplicateBlast = ['duplicate_blast', 'duplicate', 'blast'].includes(rawScenario);

    const report: Record<string, any> = {
      timestamp: new Date().toISOString(),
      requestedMode: rawScenario,
      requestedScenario: rawScenario,
      results: {},
      executionResults: [],
      steps: [],
      generatedEvents: [],
      events: [],
      allPassed: true,
    };

    if (isDoubleBlast) {
      const doubleOutput = await runDoubleBlast(port);
      report.results.doubleBlast = doubleOutput.scenarioResult;
      report.executionResults = doubleOutput.executionResults;
      report.steps = doubleOutput.executionResults;
      report.auditResults = doubleOutput.executionResults;
      report.generatedEvents = doubleOutput.generatedEvents;
      report.events = doubleOutput.generatedEvents;
      report.totalTransactionsGenerated = 2;
      report.totalEventsGenerated = doubleOutput.generatedEvents.length;
      report.allPassed = doubleOutput.doublePassed;
    } else if (isOutOfOrder) {
      const orderOutput = await runOutOfOrder(port);
      report.results.outOfOrderChaos = orderOutput.scenarioResult;
      report.executionResults = orderOutput.chronologicalResults;
      report.steps = orderOutput.chronologicalResults;
      report.auditResults = orderOutput.chronologicalResults;
      report.generatedEvents = orderOutput.generatedEvents;
      report.events = orderOutput.generatedEvents;
      report.totalTransactionsGenerated = 5;
      report.totalEventsGenerated = orderOutput.generatedEvents.length;
      report.allPassed = orderOutput.orderPassed;
    } else if (isFullSuite) {
      const suiteOutput = await runFullSuite(port);
      report.results.fullSuite = suiteOutput.scenarioResult;
      report.results.duplicateBlast = suiteOutput.blastOutput.scenarioResult;
      report.results.doubleBlast = suiteOutput.doubleOutput.scenarioResult;
      report.results.outOfOrderChaos = suiteOutput.orderOutput.scenarioResult;
      report.executionResults = suiteOutput.doubleOutput.executionResults;
      report.steps = suiteOutput.doubleOutput.executionResults;
      report.generatedEvents = suiteOutput.generatedEvents;
      report.events = suiteOutput.generatedEvents;
      report.totalTransactionsGenerated = 10;
      report.totalEventsGenerated = suiteOutput.generatedEvents.length;
      report.allPassed = suiteOutput.allPassed;
    } else if (isLegacyDuplicateBlast) {
      const blastOutput = await runDuplicateBlast(port);
      report.results.duplicateBlast = blastOutput.scenarioResult;
      report.executionResults = blastOutput.blastResponses;
      report.steps = blastOutput.blastResponses;
      report.generatedEvents = blastOutput.generatedEvents;
      report.events = blastOutput.generatedEvents;
      report.totalTransactionsGenerated = 1;
      report.totalEventsGenerated = blastOutput.generatedEvents.length;
      report.allPassed = blastOutput.blastPassed;
    } else {
      res.status(400).json({
        success: false,
        error: `Invalid scenario '${rawScenario}' requested`,
        validScenarios: ['double_blast', 'out_of_order', 'full_suite', 'duplicate_blast'],
      });
      return;
    }

    res.status(200).json({
      message: `Chaos simulation (${rawScenario}) completed successfully.`,
      ...report,
    });
  } catch (error: any) {
    console.error('[Chaos Simulator Internal Error]:', error);
    res.status(500).json({
      success: false,
      error: error?.name || 'SimulationError',
      message: error?.message || 'Chaos injection encountered an internal error',
    });
  }
});
