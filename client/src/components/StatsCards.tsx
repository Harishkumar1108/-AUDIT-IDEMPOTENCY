import React from 'react';
import type { LedgerSummary, AuditFeedItem, Transaction } from '../types';

interface StatsCardsProps {
  summary: LedgerSummary | null;
  feedItems: AuditFeedItem[];
  transactions: Transaction[];
}

export const StatsCards: React.FC<StatsCardsProps> = ({ summary, feedItems, transactions }) => {
  const droppedDuplicatesCount = feedItems.filter((i) => i.type === 'IDEMPOTENCY_DROPPED').length;

  const settledVolumeInr = transactions
    .filter((tx) => tx.derivedStatus === 'SUCCESS')
    .reduce((sum, tx) => sum + Number(tx.amount || 0), 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      {/* Total Settled Volume in INR */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-sm hover:border-zinc-700 transition-all flex flex-col justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-emerald-400 mb-2 flex items-center justify-between">
            <span>Settled Volume</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          </div>
          <div className="text-2xl md:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
            ₹{settledVolumeInr.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3 font-mono">Verified successful INR</p>
      </div>

      {/* Confirmed SUCCESS count */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-sm hover:border-zinc-700 transition-all flex flex-col justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Successful Transactions
          </div>
          <div className="text-2xl md:text-3xl font-bold font-mono text-zinc-100 tracking-tight">
            {summary?.statusCounts?.SUCCESS ?? 0}
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3">Resolved terminal state</p>
      </div>

      {/* Flagged MANUAL_REVIEW */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-sm hover:border-amber-500/40 transition-all flex flex-col justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-amber-400 mb-2 flex items-center justify-between">
            <span>Manual Review</span>
            {(summary?.statusCounts?.MANUAL_REVIEW ?? 0) > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            )}
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-2xl md:text-3xl font-bold font-mono text-amber-400 tracking-tight">
              {summary?.statusCounts?.MANUAL_REVIEW ?? 0}
            </span>
            {(summary?.statusCounts?.MANUAL_REVIEW ?? 0) > 0 && (
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                FLAGGED
              </span>
            )}
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3">Out-of-order & contradictions</p>
      </div>

      {/* Intercepted Duplicates Dropped */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-sm hover:border-rose-500/40 transition-all flex flex-col justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-rose-400 mb-2 flex items-center justify-between">
            <span>Duplicates Dropped</span>
            <span className="text-xs font-mono font-semibold text-rose-400/80">200 OK</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold font-mono text-rose-400 tracking-tight">
            {droppedDuplicatesCount}
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3">Zero duplicate billing</p>
      </div>

      {/* Total Audit Events */}
      <div className="bg-zinc-900/60 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 shadow-sm hover:border-zinc-700 transition-all flex flex-col justify-between">
        <div>
          <div className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
            Audit Stream Logs
          </div>
          <div className="text-2xl md:text-3xl font-bold font-mono text-zinc-100 tracking-tight">
            {summary?.totalEventsLogged ?? 0}
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-3">Immutable PostgreSQL events</p>
      </div>
    </div>
  );
};
