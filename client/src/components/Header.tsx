import React from 'react';
import { ShieldCheck, RefreshCw, Zap, RotateCcw } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  isRefreshing: boolean;
  autoRefresh: boolean;
  setAutoRefresh: (val: boolean) => void;
  onResetData?: () => void;
  isResetting?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  onRefresh,
  isRefreshing,
  autoRefresh,
  setAutoRefresh,
  onResetData,
  isResetting,
}) => {
  return (
    <header className="border-b border-zinc-800/90 bg-zinc-950/80 backdrop-blur-xl sticky top-0 z-30 mb-8 -mx-4 md:-mx-8 px-6 md:px-8 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      {/* Brand & Clean Technical Title */}
      <div className="flex items-center gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-100 shrink-0 shadow-sm">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
        </div>

        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-semibold tracking-wider uppercase text-zinc-400">
              PAYMENT CORE // FAULT TOLERANCE
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              IDEMPOTENCY ARMED
            </span>
          </div>
          <h1 className="text-lg md:text-xl font-bold text-zinc-100 tracking-tight mt-0.5">
            RECONCILIATION ENGINE // AUDIT & IDEMPOTENCY
          </h1>
        </div>
      </div>

      {/* Controls: Dark Zinc Surfaces */}
      <div className="flex items-center gap-3">
        {/* Reset Data Button */}
        {onResetData && (
          <button
            type="button"
            onClick={onResetData}
            disabled={isResetting || isRefreshing}
            title="Clear all transactions, events, and idempotency keys to start with a fresh state for demo"
            className="h-9 px-3 rounded-lg bg-zinc-900 hover:bg-rose-950/30 border border-zinc-800 hover:border-rose-900/60 text-zinc-400 hover:text-rose-300 text-xs font-mono font-medium inline-flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin text-rose-400' : 'text-zinc-500'}`} />
            <span>{isResetting ? 'RESETTING...' : 'RESET DATA'}</span>
          </button>
        )}

        {/* Live Polling Toggle */}
        <button
          type="button"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className={`h-9 px-3.5 rounded-lg border text-xs font-mono font-medium inline-flex items-center gap-2 transition-all ${
            autoRefresh
              ? 'bg-zinc-900 text-zinc-100 border-zinc-700 shadow-sm'
              : 'bg-transparent text-zinc-500 border-zinc-800 hover:text-zinc-300'
          }`}
        >
          <Zap className={`w-3.5 h-3.5 ${autoRefresh ? 'text-amber-400' : 'text-zinc-600'}`} />
          <span>POLLING: {autoRefresh ? '2s' : 'OFF'}</span>
        </button>

        {/* Sync Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-9 px-4 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-100 text-xs font-mono font-medium inline-flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-zinc-400'}`} />
          <span>SYNC LEDGER</span>
        </button>
      </div>
    </header>
  );
};
