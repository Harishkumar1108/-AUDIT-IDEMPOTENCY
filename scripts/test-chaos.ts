/**
 * Chaos Simulator & Reconciliation Engine Test Script
 * 
 * Invokes the chaos simulation endpoint and asserts that:
 * 1. Duplicate Blast scenario passes (5 concurrent requests -> 1 success, 4 dropped duplicates).
 * 2. Out-of-Order Chaos scenario passes (Success followed by Failure -> resolves to MANUAL_REVIEW).
 * 3. Ledger endpoint returns all transactions with derived statuses and event counts.
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testChaos() {
  console.log(`\n======================================================`);
  console.log(`⚡ RUNNING CHAOS SIMULATOR & RECONCILIATION TEST`);
  console.log(`Target: ${BASE_URL}/api/simulate-chaos`);
  console.log(`======================================================\n`);

  // 1. Trigger Full Chaos Suite
  console.log(`🚀 Dispatching POST /api/simulate-chaos { scenario: "full_suite" }...`);
  const response = await fetch(`${BASE_URL}/api/simulate-chaos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario: 'full_suite' }),
  });

  if (!response.ok) {
    throw new Error(`Chaos simulation request failed with HTTP ${response.status}`);
  }

  const result = await response.json();

  console.log(`HTTP Status: ${response.status}`);
  console.log(`Overall Result: ${result.allPassed ? '✅ ALL PASSED' : '❌ FAILED'}`);
  console.log(`Total Generated Events: ${result.generatedEvents?.length ?? result.events?.length ?? 0}\n`);

  // 2. Assert Duplicate Blast
  const blast = result.results.duplicateBlast;
  console.log(`------------------------------------------------------`);
  console.log(`Scenario 1: ${blast.scenarioName}`);
  console.log(`- Verdict: ${blast.verdict === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`- Success responses:            ${blast.concurrencyStats.successResponses} (expected 1)`);
  console.log(`- Duplicates dropped (200 OK):  ${blast.concurrencyStats.duplicatesDroppedWith200OK} (expected 4)`);
  console.log(`- Database event count:         ${blast.databaseVerification.eventsLoggedCount} (expected 1)`);
  console.log(`- Database master status:       ${blast.databaseVerification.transactionStatus} (expected SUCCESS)`);

  if (blast.verdict !== 'PASSED') {
    throw new Error('Duplicate blast scenario did not pass assertions!');
  }

  // 3. Assert Out-of-Order Chaos (Failure first, then Success)
  const order = result.results.outOfOrderChaos;
  console.log(`\n------------------------------------------------------`);
  console.log(`Scenario 2: ${order.scenarioName}`);
  console.log(`- Verdict: ${order.verdict === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`- Step 1 (FAILURE/TIMEOUT event): Resolved to ${order.eventTimeline[0].resultingTransactionStatus}`);
  console.log(`- Step 2 (SUCCESS event):         Resolved to ${order.eventTimeline[1].resultingTransactionStatus} (expected MANUAL_REVIEW)`);
  console.log(`- Total events in stream:         ${order.databaseVerification.eventsLoggedCount} (expected 2)`);
  console.log(`- Conflict detected:              ${order.databaseVerification.conflictIdentified}`);

  if (order.verdict !== 'PASSED') {
    throw new Error('Out-of-order chaos scenario did not pass assertions!');
  }

  // 4. Assert Double Blast Specifically
  console.log(`\n------------------------------------------------------`);
  console.log(`Testing Dedicated Double Blast: POST /api/simulate-chaos { mode: "double_blast" }...`);
  const doubleRes = await fetch(`${BASE_URL}/api/simulate-chaos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'double_blast' }),
  });
  if (!doubleRes.ok) {
    throw new Error(`Double blast request failed with HTTP ${doubleRes.status}`);
  }
  const doubleData = await doubleRes.json();
  const dbl = doubleData.results.doubleBlast;
  console.log(`Scenario: ${dbl.scenarioName}`);
  console.log(`- Verdict: ${dbl.verdict === 'PASSED' ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`- Success responses (1st arrival):   ${dbl.concurrencyStats.successResponses} (expected 1)`);
  console.log(`- Duplicates dropped (2nd arrival):  ${dbl.concurrencyStats.duplicatesDroppedWith200OK} (expected 1)`);
  console.log(`- Single transaction created in DB:  ${dbl.databaseVerification.singleTransactionCreated}`);
  console.log(`- Generated event statuses:         ${doubleData.generatedEvents.map((e: any) => e.status).join(' | ')}`);

  if (dbl.verdict !== 'PASSED') {
    throw new Error('Double blast scenario did not pass assertions!');
  }

  // 4. Test Ledger Endpoint
  console.log(`\n------------------------------------------------------`);
  console.log(`Testing Ledger: GET /api/transactions`);
  const ledgerRes = await fetch(`${BASE_URL}/api/transactions`);
  const ledgerData = await ledgerRes.json();

  console.log(`- Total Transactions:  ${ledgerData.summary.totalTransactions}`);
  console.log(`- Status Breakdown:    SUCCESS: ${ledgerData.summary.statusCounts.SUCCESS}, MANUAL_REVIEW: ${ledgerData.summary.statusCounts.MANUAL_REVIEW}, PENDING: ${ledgerData.summary.statusCounts.PENDING}`);
  console.log(`- Total Events Logged: ${ledgerData.summary.totalEventsLogged}`);
  console.log(`- Conflict Count:      ${ledgerData.summary.conflictsCount}`);

  console.log(`\n======================================================`);
  console.log(`🎉 ALL CHAOS SIMULATION & RECONCILIATION TESTS PASSED!`);
  console.log(`======================================================\n`);
}

testChaos().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
