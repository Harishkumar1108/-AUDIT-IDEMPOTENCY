export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'MANUAL_REVIEW';

export interface TransactionEvent {
  id: string;
  eventId: string;
  payload: any;
  createdAt: string;
}

export interface Transaction {
  id: string;
  customer: string;
  amount: number;
  currency: string;
  status: TransactionStatus;
  derivedStatus: TransactionStatus;
  eventCount: number;
  hasConflict: boolean;
  reason?: string;
  isSynchronized?: boolean;
  createdAt: string;
  updatedAt: string;
  events?: TransactionEvent[];
}

export interface LedgerSummary {
  totalTransactions: number;
  statusCounts: {
    SUCCESS: number;
    MANUAL_REVIEW: number;
    PENDING: number;
  };
  totalEventsLogged: number;
  conflictsCount: number;
}

export interface AuditFeedItem {
  id: string;
  timestamp: string;
  eventId: string;
  transactionId?: string;
  type: 'PROCESSED' | 'IDEMPOTENCY_DROPPED' | 'CONFLICT_DETECTED';
  badge: 'LOGGED' | 'DROPPED' | 'CONFLICT';
  message: string;
  amount?: number;
  currency?: string;
  customer?: string;
  payload?: any;
}

export interface ChaosResponse {
  message: string;
  timestamp: string;
  requestedScenario?: string;
  requestedMode?: string;
  allPassed: boolean;
  generatedEvents?: any[];
  events?: any[];
  totalTransactionsGenerated?: number;
  results: {
    doubleBlast?: {
      scenarioName: string;
      verdict: 'PASSED' | 'FAILED';
      concurrencyStats: {
        totalFired: number;
        successResponses: number;
        duplicatesDroppedWith200OK: number;
      };
      databaseVerification: {
        transactionStatus: string;
        eventsLoggedCount: number;
      };
      rawResponses: Array<{
        attempt: number;
        httpStatus: number;
        statusField: string;
        message: string;
      }>;
    };
    duplicateBlast?: {
      scenarioName: string;
      verdict: 'PASSED' | 'FAILED';
      concurrencyStats: {
        totalFired: number;
        successResponses: number;
        duplicatesDroppedWith200OK: number;
      };
      databaseVerification: {
        transactionStatus: string;
        eventsLoggedCount: number;
      };
      rawResponses: Array<{
        attempt: number;
        httpStatus: number;
        statusField: string;
        message: string;
      }>;
    };
    outOfOrderChaos?: {
      scenarioName: string;
      verdict: 'PASSED' | 'FAILED';
      eventTimeline: Array<{
        step: number;
        signalSent: string;
        resultingTransactionStatus: string;
      }>;
      databaseVerification: {
        finalMasterStatus: string;
        eventsLoggedCount: number;
        conflictIdentified: boolean;
      };
    };
    fullSuite?: {
      scenarioName: string;
      verdict: 'PASSED' | 'FAILED';
      totalRecordsInserted: number;
      statusBreakdown: {
        SUCCESS: number;
        MANUAL_REVIEW: number;
        PENDING: number;
      };
      customersAssigned: string[];
    };
  };
}
