import React, { useState, useRef, useEffect } from 'react';
import { ArrowDown, ChevronRight, ChevronDown, Terminal } from 'lucide-react';
import type { AuditFeedItem } from '../types';

interface LiveEventStreamProps {
  feedItems: AuditFeedItem[];
}

export const LiveEventStream: React.FC<LiveEventStreamProps> = ({ feedItems }) => {
  const [filter, setFilter] = useState<'ALL' | 'DROPPED' | 'LOGGED'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredItems = feedItems.filter((item) => {
    if (filter === 'DROPPED') return item.type === 'IDEMPOTENCY_DROPPED';
    if (filter === 'LOGGED') return item.type === 'PROCESSED' || item.type === 'CONFLICT_DETECTED';
    return true;
  });

  const droppedCount = feedItems.filter((i) => i.type === 'IDEMPOTENCY_DROPPED').length;
  const processedCount = feedItems.filter((i) => i.type === 'PROCESSED' || i.type === 'CONFLICT_DETECTED').length;

  useEffect(() => {
    if (autoScroll && containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [feedItems, autoScroll]);

  return (
    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur-md border border-zinc-800 shadow-xl overflow-hidden flex flex-col h-[720px] min-h-[600px] w-full">
      {/* Terminal Title Bar with Generous Padding */}
      <div className="px-6 md:px-8 py-5 bg-zinc-900/90 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
            <Terminal className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-base font-bold text-zinc-100">
                AUDIT_STREAM://events.log
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <span className="text-xs text-zinc-400 font-mono">
              REAL-TIME IMMUTABLE WEBHOOK INGESTION & IDEMPOTENCY AUDIT FEED
            </span>
          </div>
        </div>

        {/* Filter Tabs & Auto-scroll */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-xs font-mono">
            <button
              type="button"
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'ALL' ? 'bg-zinc-800 text-zinc-100 font-bold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All ({feedItems.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('DROPPED')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'DROPPED' ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30' : 'text-zinc-400 hover:text-rose-400'
              }`}
            >
              Dropped ({droppedCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('LOGGED')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                filter === 'LOGGED' ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30' : 'text-zinc-400 hover:text-emerald-400'
              }`}
            >
              Logged ({processedCount})
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Disable Auto-scroll' : 'Enable Auto-scroll'}
            className={`h-8 w-8 rounded-lg border flex items-center justify-center transition-all ${
              autoScroll
                ? 'bg-zinc-800 text-emerald-400 border-zinc-700'
                : 'bg-zinc-950 text-zinc-600 border-zinc-800 hover:text-zinc-400'
            }`}
          >
            <ArrowDown className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Feed Body */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-5 space-y-3 font-mono text-sm select-text bg-zinc-950/70"
      >
        {filteredItems.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-500 space-y-2 font-mono text-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-zinc-600 animate-ping mb-2"></span>
            <p className="font-semibold text-zinc-400">Awaiting incoming payment webhooks...</p>
            <p className="text-xs text-zinc-600">Trigger "Inject Chaos" above to stream concurrent duplicate blasts.</p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isDropped = item.type === 'IDEMPOTENCY_DROPPED';
            const isConflict = item.type === 'CONFLICT_DETECTED';
            const isExpanded = expandedId === item.id;

            return (
              <div
                key={item.id}
                className={`p-4 rounded-xl border transition-all ${
                  isDropped
                    ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                    : isConflict
                    ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                    : 'bg-zinc-900/50 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <div
                  className="flex items-start justify-between gap-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex-1 min-w-0">
                    {/* Badge + event id + time */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      {isDropped ? (
                        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 tracking-tight">
                          DROPPED — Duplicate event intercepted
                        </span>
                      ) : isConflict ? (
                        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 tracking-tight">
                          CONFLICT — Review Required
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded text-xs font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 tracking-tight">
                          LOGGED — Unique event processed
                        </span>
                      )}

                      <span className="text-zinc-200 font-bold font-mono text-sm truncate">
                        {item.eventId}
                      </span>

                      <span className="text-xs font-mono text-zinc-500 ml-auto">
                        {new Date(item.timestamp).toLocaleTimeString()}
                      </span>
                    </div>

                    {/* Explanatory Message */}
                    <p className={`mt-2 text-sm leading-relaxed font-sans ${
                      isDropped ? 'text-rose-200/90' : isConflict ? 'text-amber-200/90' : 'text-zinc-300'
                    }`}>
                      {item.message}
                    </p>

                    {/* Transaction Reference & Amount in INR */}
                    {item.transactionId && (
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-mono text-zinc-400">
                        <span>tx: <span className="text-zinc-200 font-semibold">{item.transactionId}</span></span>
                        {item.amount !== undefined && (
                          <span className="text-emerald-400 font-bold">
                            ₹{item.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                          </span>
                        )}
                        {item.customer && (
                          <span>&bull; {item.customer}</span>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="text-zinc-500 shrink-0 mt-1">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-zinc-300" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </div>
                </div>

                {/* Expanded Raw Payload Inspector */}
                {isExpanded && item.payload && (
                  <div className="mt-3 pt-3 border-t border-zinc-800">
                    <div className="text-xs font-mono uppercase font-semibold text-zinc-400 mb-1.5">
                      Ingested JSONB Payload:
                    </div>
                    <pre className="p-3 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-300 overflow-x-auto">
                      {JSON.stringify(item.payload, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
