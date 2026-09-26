import { useState, useEffect, useCallback } from 'react';
import { Database, Terminal } from 'lucide-react';
import { Header } from './components/Header';
import { StatsCards } from './components/StatsCards';
import { ChaosActionPanel } from './components/ChaosActionPanel';
import { TransactionLedger } from './components/TransactionLedger';
import { LiveEventStream } from './components/LiveEventStream';
import { EventDetailModal } from './components/EventDetailModal';
import type { Transaction, LedgerSummary, AuditFeedItem, ChaosResponse } from './types';

export function App() {
  const [activeTab, setActiveTab] = useState<'ledger' | 'stream'>('ledger');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [summary, setSummary] = useState<LedgerSummary | null>(null);
  const [feedItems, setFeedItems] = useState<AuditFeedItem[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [lastChaosResult, setLastChaosResult] = useState<ChaosResponse | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Reset Data handler
  const handleResetData = async () => {
    if (!window.confirm('Reset all transaction ledger records, events, and idempotency keys to a fresh empty state?')) {
      return;
    }
    setIsResetting(true);
    try {
      const res = await fetch('/api/reset-data', { method: 'POST' });
      if (res.ok) {
        setTransactions([]);
        setSummary(null);
        setFeedItems([]);
        setLastChaosResult(null);
        await refreshAll(false);
      }
    } catch (err) {
      console.error('Failed to reset data:', err);
    } finally {
      setIsResetting(false);
    }
  };

  // Fetch Transaction Ledger
  const fetchLedger = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const res = await fetch('/api/transactions');
      if (res.ok) {
        const data = await res.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary || null);
      }
    } catch (err) {
      console.error('Error fetching ledger:', err);
    } finally {
      setIsLoadingLedger(false);
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Fetch Live Event Stream
  const fetchAuditFeed = useCallback(async () => {
    try {
      const res = await fetch('/api/transactions/audit/feed');
      if (res.ok) {
        const data = await res.json();
        setFeedItems(data.feed || []);
      }
    } catch (err) {
      console.error('Error fetching audit feed:', err);
    }
  }, []);

  // Immediate refresh of all data
  const refreshAll = useCallback(async (isManual = false) => {
    await Promise.all([fetchLedger(isManual), fetchAuditFeed()]);
  }, [fetchLedger, fetchAuditFeed]);

  // Initial load
  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Real-time Polling Interval
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchLedger(false);
      fetchAuditFeed();
    }, 2000);

    return () => clearInterval(interval);
  }, [autoRefresh, fetchLedger, fetchAuditFeed]);

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans antialiased selection:bg-zinc-800 selection:text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pb-24 space-y-8">
        {/* 1. Header with Clean Title (No external branding) */}
        <Header
          onRefresh={() => refreshAll(true)}
          isRefreshing={isRefreshing}
          autoRefresh={autoRefresh}
          setAutoRefresh={setAutoRefresh}
          onResetData={handleResetData}
          isResetting={isResetting}
        />

        {/* 2. Key Metrics Overview in INR */}
        <StatsCards summary={summary} feedItems={feedItems} transactions={transactions} />

        {/* 3. The "Inject Chaos" Action Panel */}
        <ChaosActionPanel
          onChaosInjected={() => refreshAll(false)}
          lastChaosResult={lastChaosResult}
          isSimulating={isSimulating}
          setIsSimulating={setIsSimulating}
          setLastChaosResult={setLastChaosResult}
        />

        {/* 4. Top Navigation Tab System */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-800 pb-5">
          <div className="inline-flex p-1.5 rounded-2xl bg-zinc-900/90 border border-zinc-800 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveTab('ledger')}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-all ${
                activeTab === 'ledger'
                  ? 'bg-zinc-100 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Master Ledger</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'ledger' ? 'bg-zinc-300 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {transactions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('stream')}
              className={`px-5 py-2.5 rounded-xl font-mono text-xs sm:text-sm font-semibold flex items-center gap-2.5 transition-all ${
                activeTab === 'stream'
                  ? 'bg-zinc-100 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              <Terminal className="w-4 h-4" />
              <span>Audit Event Stream</span>
              <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-bold ${
                activeTab === 'stream' ? 'bg-zinc-300 text-zinc-900' : 'bg-zinc-800 text-zinc-400'
              }`}>
                {feedItems.length}
              </span>
              {feedItems.some((i) => i.type === 'IDEMPOTENCY_DROPPED') && (
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse ml-0.5" title="Idempotency Interceptions Recorded" />
              )}
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
            <span className="hidden sm:inline">Active Consensus:</span>
            <span className="px-3.5 py-1.5 rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Deterministic State Reducer Consensus
            </span>
          </div>
        </div>

        {/* 5. Full-Width Tab Views (No Side-by-Side Crowding) */}
        <div className="w-full">
          {activeTab === 'ledger' ? (
            <TransactionLedger
              transactions={transactions}
              isLoading={isLoadingLedger}
              onSelectTransaction={(tx) => setSelectedTransaction(tx)}
            />
          ) : (
            <LiveEventStream feedItems={feedItems} />
          )}
        </div>

        {/* 6. Deep Inspection Modal */}
        <EventDetailModal
          transaction={selectedTransaction}
          onClose={() => setSelectedTransaction(null)}
        />
      </div>
    </div>
  );
}

export default App;
