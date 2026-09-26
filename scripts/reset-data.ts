import { prisma } from '../src/prisma';
import { clearAuditFeed } from '../src/services/auditFeed';

async function resetData() {
  console.log('🧹 Clearing all transactions, events, and idempotency keys from database...');
  const [events, keys, txs] = await prisma.$transaction([
    prisma.event.deleteMany(),
    prisma.idempotencyKey.deleteMany(),
    prisma.transaction.deleteMany(),
  ]);

  clearAuditFeed();

  console.log(`✅ Reset complete!`);
  console.log(`- Deleted transactions:     ${txs.count}`);
  console.log(`- Deleted immutable events: ${events.count}`);
  console.log(`- Deleted idempotency keys: ${keys.count}`);
  console.log(`\nWebsite and backend now start with a fresh, empty state for demo.`);
}

resetData()
  .catch((err) => {
    console.error('Failed to reset data:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
