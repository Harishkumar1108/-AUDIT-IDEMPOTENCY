# Payment Idempotency, Reconciliation Engine & React Dashboard

A resilient full-stack payment reconciliation system built with **Node.js, Express, Prisma ORM, PostgreSQL, React 19, and Tailwind CSS v3**. Designed to prevent double payments ("The Payment That Happened Twice"), reduce chronological event streams into deterministic master states, and provide a real-time dark-mode dashboard with live chaos simulation.

---

## 🎨 Frontend Dashboard Overview

The React + Tailwind CSS dashboard is accessible at:
- **`http://localhost:3000`** (served directly by Express full-stack)
- **`http://localhost:5173`** (Vite development server with HMR)

### Core Sections:

1. **The Transaction Ledger Table**:
   - Fetches live data from `GET /api/transactions`.
   - Data grid displaying: **Transaction ID** (with one-click copy), **Customer** (with avatar), **Amount**, **Currency**, **Master Status**, and **Audit Logs**.
   - Color-coded badges for:
     - 🟢 **`SUCCESS`**: Payment confirmed by terminal event without contradiction.
     - 🟠 **`MANUAL_REVIEW`**: Flagged due to conflicting or out-of-order signals (with animated pulse alert).
     - 🔵 **`PENDING`**: Initial or processing state awaiting confirmation.
   - Real-time search by ID, customer name, or amount, plus status filter tabs.
   - Deep inspection modal displaying the full chronological event log and reducer rationale.

2. **The Live Event Stream (Audit Log)**:
   - High-tech terminal panel (`AUDIT_STREAM://events.log`) displaying incoming webhook events in real-time.
   - Automatically polls the backend feed (`GET /api/transactions/audit/feed`) every 2 seconds.
   - Clearly differentiates:
     - 🛡️ **`DROPPED (IDEMPOTENCY 200 OK)`**: Intercepted duplicate events dropped safely to prevent double-charging.
     - 🟢 **`LOGGED (UNIQUE DB WRITE)`**: Unique events persisted to the PostgreSQL `Event` table.
     - ⚠️ **`CONFLICT RESOLVED (MANUAL_REVIEW)`**: Contradictory signals detected across chronological logs.
   - Expandable raw JSONB inspector for any event in the feed.

3. **The "Inject Chaos" Action Panel**:
   - Prominent, gradient-radiant button labeled **"Inject Chaos"**.
   - Sends a `POST /api/simulate-chaos` request with selectable scenarios:
     - **Full Suite**: Blasts both concurrent duplicates and out-of-order events.
     - **Duplicate Blast (5x)**: Fires 5 identical webhooks simultaneously (`Promise.all`) to prove idempotency.
     - **Out-of-Order Chaos**: Delivers a delayed failure event after a success event to trigger state reducer contradiction detection.
   - Instant live notification banner reporting execution status, concurrency stats, and automatically refreshing the ledger and stream on screen.

---

## 🏗️ Architecture & PostgreSQL Models

```prisma
enum TransactionStatus {
  PENDING
  SUCCESS
  MANUAL_REVIEW
}

model Transaction {
  id        String            @id @default(uuid())
  amount    Decimal           @db.Decimal(12, 2)
  status    TransactionStatus @default(PENDING)
  createdAt DateTime          @default(now()) @map("created_at")
  updatedAt DateTime          @updatedAt @map("updated_at")

  events Event[]

  @@map("transactions")
}

model Event {
  id            String      @id @default(uuid())
  eventId       String      @map("event_id")
  transactionId String      @map("transaction_id")
  transaction   Transaction @relation(fields: [transactionId], references: [id], onDelete: Cascade)
  payload       Json        @db.JsonB
  createdAt     DateTime    @default(now()) @map("created_at")

  @@index([eventId])
  @@index([transactionId])
  @@map("events")
}

model IdempotencyKey {
  id        String   @id @default(uuid())
  eventId   String   @unique @map("event_id")
  createdAt DateTime @default(now()) @map("created_at")

  @@map("idempotency_keys")
}
```

---

## 🚀 Running the Project

### Prerequisites
- Node.js (v18+)
- PostgreSQL running locally on port 5432 (or via Docker Compose: `docker compose up -d`)

### 1. Database Setup
```bash
# Push schema to PostgreSQL
npm run prisma:push
```

### 2. Start Backend & Frontend

```bash
# Start backend server (serves API & built React frontend at http://localhost:3000)
npm run dev

# Or run Vite dev server with Hot Module Replacement at http://localhost:5173
npm run client:dev

# Rebuild frontend bundle
npm run client:build
```

---

## 🧪 Testing Commands

```bash
# Test webhook idempotency & concurrency race conditions
npm run test:webhook

# Test chaos simulator & state reducer reconciliation
npm run test:chaos

# Run both automated test suites
npm run test:all
```
