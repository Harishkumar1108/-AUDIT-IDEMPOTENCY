/**
 * Verification & Demonstration Script
 * 
 * Tests the idempotency behavior of POST /api/webhooks:
 * 1. Single delivery: unique event is logged and transaction is created.
 * 2. Duplicate delivery: identical event is detected and dropped with 200 OK.
 * 3. Race condition delivery: 5 concurrent identical webhooks fired simultaneously,
 *    demonstrating only 1 is logged and 4 are dropped with 200 OK.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function sendWebhook(payload: Record<string, any>, idempotencyHeader?: string) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (idempotencyHeader) {
    headers['Idempotency-Key'] = idempotencyHeader;
  }

  const response = await fetch(`${BASE_URL}/api/webhooks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  return { status: response.status, data };
}

async function runTests() {
  console.log(`\n======================================================`);
  console.log(`🧪 TESTING PAYMENT IDEMPOTENCY WEBHOOK ENDPOINT`);
  console.log(`Target URL: ${BASE_URL}/api/webhooks`);
  console.log(`======================================================\n`);

  const testEventId = `evt_test_${Date.now()}`;
  const testTxId = `txn_${Date.now()}`;

  const payload = {
    event_id: testEventId,
    transaction_id: testTxId,
    amount: 2499.00,
    currency: 'INR',
    status: 'SUCCESS',
    timestamp: new Date().toISOString(),
    customer: {
      email: 'rohit.sharma@example.in',
      name: 'Rohit Sharma',
    },
    payment_method: 'upi',
  };

  // Test 1: First Delivery (Should succeed)
  console.log(`🔹 [Test 1] Dispatching initial webhook (${testEventId})...`);
  const firstRes = await sendWebhook(payload);
  console.log(`Response HTTP Status: ${firstRes.status}`);
  console.log(`Response Body:`, JSON.stringify(firstRes.data, null, 2));

  if (firstRes.status === 200 && firstRes.data.status === 'success') {
    console.log(`✅ [Test 1 Passed] Unique event logged successfully!\n`);
  } else {
    console.error(`❌ [Test 1 Failed] Expected 200 with status 'success'`);
  }

  // Test 2: Second Delivery of exact same event (Should drop duplicate with 200 OK)
  console.log(`🔹 [Test 2] Dispatching duplicate webhook with SAME event_id (${testEventId})...`);
  const secondRes = await sendWebhook(payload);
  console.log(`Response HTTP Status: ${secondRes.status}`);
  console.log(`Response Body:`, JSON.stringify(secondRes.data, null, 2));

  if (secondRes.status === 200 && (secondRes.data.status === 'DROPPED' || secondRes.data.status === 'duplicate')) {
    console.log(`✅ [Test 2 Passed] Duplicate event correctly dropped with 200 OK!\n`);
  } else {
    console.error(`❌ [Test 2 Failed] Expected 200 OK with status 'DROPPED' or 'duplicate'`);
  }

  // Test 3: Concurrent Race Condition Test
  const concurrentEventId = `evt_race_${Date.now()}`;
  const concurrentPayload = {
    event_id: concurrentEventId,
    transaction_id: `txn_race_${Date.now()}`,
    amount: 14999.00,
    currency: 'INR',
    status: 'SUCCESS',
  };

  console.log(`🔹 [Test 3] Simulating concurrent race condition: 5 identical requests sent simultaneously (${concurrentEventId})...`);
  const concurrentResponses = await Promise.all([
    sendWebhook(concurrentPayload),
    sendWebhook(concurrentPayload),
    sendWebhook(concurrentPayload),
    sendWebhook(concurrentPayload),
    sendWebhook(concurrentPayload),
  ]);

  const successes = concurrentResponses.filter(
    (r) => r.status === 200 && (r.data.status === 'success' || (r.data.success === true && r.data.status !== 'DROPPED'))
  );
  const duplicates = concurrentResponses.filter(
    (r) => r.status === 200 && (r.data.status === 'DROPPED' || r.data.status === 'duplicate')
  );

  console.log(`Concurrent results:`);
  console.log(`- Success responses:    ${successes.length} (expected: 1)`);
  console.log(`- Duplicate 200 OKs:    ${duplicates.length} (expected: 4)`);

  if (successes.length === 1 && duplicates.length === 4) {
    console.log(`✅ [Test 3 Passed] Race condition handled safely! Exactly 1 unique write, 4 duplicates dropped.\n`);
  } else {
    console.warn(`⚠️ Race test finished with: ${successes.length} successes, ${duplicates.length} duplicates.`);
  }

  // Verify Audit Logs
  try {
    const auditRes = await fetch(`${BASE_URL}/api/transactions/audit/events`);
    if (auditRes.ok) {
      const auditData = await auditRes.json();
      console.log(`📊 Audit Summary: Total events in DB = ${auditData.count}`);
    }
  } catch (err) {
    // Ignore audit error if any
  }

  console.log(`======================================================`);
  console.log(`🎉 ALL TESTS COMPLETED`);
  console.log(`======================================================\n`);
}

runTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
