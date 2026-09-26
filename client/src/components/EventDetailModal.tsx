import React from 'react';
import { X, ShieldCheck, AlertTriangle, Clock } from 'lucide-react';
import type { Transaction } from '../types';

interface EventDetailModalProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const EventDetailModal: React.FC<EventDetailModalProps> = ({ transaction, onClose }) => {
  if (!transaction) return null;

  const formattedAmount = `₹${Number(transaction.amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
      <div className="relative w-full max-w-3xl max-h-[88vh] overflow-hidden rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-base font-semibold text-zinc-100 font-mono tracking-tight">
                {transaction.id}
              </h3>
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-medium border ${
                transaction.derivedStatus === 'SUCCESS'
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-500/30'
                  : transaction.derivedStatus === 'MANUAL_REVIEW'
                  ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-800/80 text-zinc-300 border-zinc-700'
              }`}>
                {transaction.derivedStatus === 'SUCCESS' && <ShieldCheck className="w-3.5 h-3.5" />}
                {transaction.derivedStatus === 'MANUAL_REVIEW' && <AlertTriangle className="w-3.5 h-3.5" />}
                {transaction.derivedStatus === 'PENDING' && <Clock className="w-3.5 h-3.5" />}
                {transaction.derivedStatus}
              </span>
            </div>
            <p className="text-sm text-zinc-400 mt-2 font-sans flex items-center gap-3">
              <span>Customer: <strong className="text-zinc-200 font-medium">{transaction.customer}</strong></span>
              <span className="text-zinc-600">&bull;</span>
              <span>Amount: <strong className="text-zinc-100 font-mono font-semibold">{formattedAmount}</strong> <span className="text-zinc-500 text-xs">INR</span></span>
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-100 flex items-center justify-center transition-colors border border-transparent hover:border-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-zinc-950 text-zinc-100">
          {/* Rationale Card */}
          <div className={`p-5 rounded-xl border text-sm ${
            transaction.hasConflict
              ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
              : 'bg-zinc-900/60 border-zinc-800 text-zinc-300'
          }`}>
            <div className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              Deterministic State Reducer Rationale
            </div>
            <p className="leading-relaxed font-sans text-sm text-zinc-200">
              {transaction.reason || 'Chronological event stream processed and consensus resolved idempotently.'}
            </p>
          </div>

          {/* Chronological Event History */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="font-mono text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Historical Event Stream ({transaction.events?.length ?? 0} events)
              </div>
              <span className="text-xs text-zinc-500 font-mono">Chronological order (oldest to newest)</span>
            </div>

            <div className="space-y-3">
              {transaction.events && transaction.events.length > 0 ? (
                transaction.events.map((evt, idx) => (
                  <div
                    key={evt.id || idx}
                    className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800 space-y-3 font-mono text-xs"
                  >
                    <div className="flex items-center justify-between text-zinc-400 text-xs pb-2 border-b border-zinc-800/80">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center font-bold text-zinc-200 text-xs border border-zinc-700">
                          {idx + 1}
                        </span>
                        <span className="text-zinc-200 font-semibold">{evt.eventId}</span>
                      </div>
                      <span className="text-zinc-500">{new Date(evt.createdAt).toLocaleTimeString()}</span>
                    </div>

                    <pre className="p-3 rounded-lg bg-black border border-zinc-800/80 text-xs text-emerald-400 overflow-x-auto max-h-48 scrollbar-thin">
                      {JSON.stringify(evt.payload, null, 2)}
                    </pre>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-sm text-zinc-500 font-mono bg-zinc-900/30 rounded-xl border border-zinc-800/60">
                  No historical events recorded for this transaction.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
