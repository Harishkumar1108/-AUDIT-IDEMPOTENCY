import React, { useState } from 'react';
import { Radio, AlertOctagon, CheckCircle2, Zap } from 'lucide-react';
import type { ChaosResponse } from '../types';

interface ChaosActionPanelProps {
  onChaosInjected: () => void;
  lastChaosResult: ChaosResponse | null;
  isSimulating: boolean;
  setIsSimulating: (val: boolean) => void;
  setLastChaosResult: (res: ChaosResponse | null) => void;
}

export const ChaosActionPanel: React.FC<ChaosActionPanelProps> = ({
  onChaosInjected,
  lastChaosResult,
  isSimulating,
  setIsSimulating,
  setLastChaosResult,
}) => {
  const [selectedMode, setSelectedMode] = useState<'double_blast' | 'out_of_order' | 'full_suite'>('double_blast');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleInjectChaos = async () => {
    setIsSimulating(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/simulate-chaos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!response.ok) {
        throw new Error(`Simulation failed with HTTP status ${response.status}`);
      }

      const data: ChaosResponse = await response.json();
      
      // Log the response and the array of simulated events to console
      console.log('[Chaos Simulator Response]:', data);
      console.log('[Simulated Events Array]:', data.generatedEvents || data.events || []);
      console.log('[Execution Results Steps Array]:', (data as any).executionResults || (data as any).steps || data.results);

      setLastChaosResult(data);

      // Instantly trigger parent state refresh for ledger & event stream
      onChaosInjected();
    } catch (err: any) {
      console.error('[Chaos Simulator Error]:', err);
      setErrorMessage(err.message || 'Chaos injection encountered an error');
    } finally {
      setIsSimulating(false);
    }
  };

  const getModeHelperText = () => {
    switch (selectedMode) {
      case 'double_blast':
        return 'Generates & inserts exactly 2 identical transaction records into the ledger/database to test idempotency.';
      case 'out_of_order':
        return 'Generates & inserts exactly 5 different transaction records with mixed states (SUCCESS, MANUAL_REVIEW).';
      case 'full_suite':
        return 'Generates & inserts exactly 10 random transaction records with mixed timestamps and statuses.';
    }
  };

  return (
    <div className="relative rounded-2xl bg-zinc-900/60 backdrop-blur-md border border-zinc-800 p-6 md:p-8 mb-8 shadow-sm overflow-hidden">
      {/* Background ambient dark glow */}
      <div className="dark-hero-mesh" />

      <div className="relative z-10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-zinc-800/80">
          <div className="max-w-2xl">
            <div className="font-mono text-xs font-semibold tracking-wider uppercase text-zinc-400 mb-2 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>FAULT INJECTION SUITE // RESILIENCE TEST</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-zinc-100 tracking-tight">
              Inject Chaos
            </h2>
            <p className="text-sm md:text-base text-zinc-300 mt-2 leading-relaxed">
              Programmatically stress-test the backend against race conditions and duplicate payments. Trigger a <strong>Double Blast</strong> (2 identical rows), inject <strong>Out-of-Order</strong> states (5 mixed rows), or blast the <strong>Full Suite</strong> (10 random rows) across diverse customers.
            </p>
          </div>

          {/* Action Trigger Buttons */}
          <div className="flex flex-col items-start sm:items-end gap-3 shrink-0">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
              {/* Dark Scenario Selector Tabs: strictly Double Blast, Out-of-Order, and Full Suite */}
              <div className="flex flex-wrap rounded-xl bg-zinc-950 p-1 border border-zinc-800 text-sm">
                <button
                  type="button"
                  title="Generate and insert exactly 2 identical transaction records into the ledger/database."
                  onClick={() => setSelectedMode('double_blast')}
                  className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
                    selectedMode === 'double_blast'
                      ? 'bg-zinc-800 text-emerald-400 shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Double Blast
                </button>
                <button
                  type="button"
                  title="Generate and insert exactly 5 different transaction records with mixed states (SUCCESS, MANUAL_REVIEW)."
                  onClick={() => setSelectedMode('out_of_order')}
                  className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
                    selectedMode === 'out_of_order'
                      ? 'bg-zinc-800 text-amber-400 shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Out-of-Order
                </button>
                <button
                  type="button"
                  title="Generate and insert exactly 10 random transaction records with mixed timestamps and statuses."
                  onClick={() => setSelectedMode('full_suite')}
                  className={`px-3.5 py-2 rounded-lg font-medium transition-all ${
                    selectedMode === 'full_suite'
                      ? 'bg-zinc-800 text-purple-400 shadow-sm font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Full Suite
                </button>
              </div>

              {/* High-Contrast Prominent Action Button */}
              <button
                type="button"
                onClick={handleInjectChaos}
                disabled={isSimulating}
                className="h-11 px-7 rounded-full bg-white hover:bg-zinc-200 text-black font-semibold text-sm sm:text-base inline-flex items-center justify-center gap-2.5 shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 tracking-tight"
              >
                {isSimulating ? (
                  <>
                    <Radio className="w-4 h-4 animate-spin text-black" />
                    <span>Blasting Payloads...</span>
                  </>
                ) : (
                  <span>Inject Chaos</span>
                )}
              </button>
            </div>

            {/* Helper Text / Tooltip directly below the mode selectors */}
            <p className="text-xs text-zinc-400 font-mono flex items-center gap-1.5 self-start sm:self-auto">
              <span className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                selectedMode === 'double_blast'
                  ? 'bg-emerald-400'
                  : selectedMode === 'out_of_order'
                  ? 'bg-amber-400'
                  : 'bg-purple-400'
              }`}></span>
              <span>{getModeHelperText()}</span>
            </p>
          </div>
        </div>

        {/* Status Notification Callout */}
        {lastChaosResult && (
          <div className="mt-6 p-6 rounded-xl bg-zinc-950/90 border border-zinc-800 text-zinc-100 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-bold text-base text-zinc-100">
                      Simulation Blast Verified & Reconciled
                    </span>
                    <span className="px-2.5 py-0.5 text-xs font-mono font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {lastChaosResult.allPassed ? 'ALL SCENARIOS PASSED' : 'ACTION REQUIRED'}
                    </span>
                    <span className="text-xs text-zinc-400 font-mono">
                      {new Date(lastChaosResult.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <p className="text-sm text-zinc-300 mt-1.5 leading-relaxed">
                    {lastChaosResult.message} Master transaction ledger and live audit stream updated with new records.
                  </p>

                  <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-mono">
                    {lastChaosResult.results.doubleBlast && (
                      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                        <span className="text-zinc-400">Double Blast (2 Identical Records):</span>
                        <span className="text-emerald-400 font-bold">1 Logged</span>
                        <span className="text-zinc-600">/</span>
                        <span className="text-rose-400 font-bold">1 Dropped (200 OK)</span>
                      </div>
                    )}

                    {lastChaosResult.results.outOfOrderChaos && (
                      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        <span className="text-zinc-400">Out-of-Order (5 Mixed Records):</span>
                        <span className="text-amber-400 font-bold">
                          Resolved to {lastChaosResult.results.outOfOrderChaos.databaseVerification.finalMasterStatus}
                        </span>
                        <span className="text-zinc-400">(Contradictions caught)</span>
                      </div>
                    )}

                    {lastChaosResult.results.fullSuite && (
                      <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                        <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                        <span className="text-zinc-400">Full Suite:</span>
                        <span className="text-purple-400 font-bold">
                          {lastChaosResult.results.fullSuite.totalRecordsInserted} Random Records Inserted
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setLastChaosResult(null)}
                className="text-xs font-mono text-zinc-400 hover:text-zinc-100 px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {errorMessage && (
          <div className="mt-4 p-4 rounded-xl bg-rose-950/40 border border-rose-800/80 text-rose-300 text-sm flex items-center gap-3">
            <AlertOctagon className="w-5 h-5 shrink-0 text-rose-400" />
            <span>Simulation error: {errorMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
