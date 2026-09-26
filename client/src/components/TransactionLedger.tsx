import React, { useState } from 'react';
import { Copy, Check, Search, Eye, Filter } from 'lucide-react';
import type { Transaction, TransactionStatus } from '../types';

interface TransactionLedgerProps {
  transactions: Transaction[];
  isLoading: boolean;
  onSelectTransaction: (tx: Transaction) => void;
}

export const TransactionLedger: React.FC<TransactionLedgerProps> = ({
  transactions,
  isLoading,
  onSelectTransaction,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TransactionStatus>('ALL');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const filteredTransactions = transactions.filter((tx) => {
    const matchesSearch =
      tx.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.amount.toString().includes(searchTerm);

    const matchesStatus = statusFilter === 'ALL' || tx.derivedStatus === statusFilter || tx.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: TransactionStatus) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
            SUCCESS
          </span>
        );
      case 'MANUAL_REVIEW':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            MANUAL_REVIEW
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
            PENDING
          </span>
        );
    }
  };

  return (
    <div className="rounded-2xl bg-zinc-900/60 backdrop-blur-md border border-zinc-800 overflow-hidden shadow-sm">
      {/* Header & Controls with Generous Padding */}
      <div className="p-6 md:p-7 border-b border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80">
        <div>
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg md:text-xl font-bold text-zinc-100 tracking-tight">
              The Transaction Ledger
            </h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-zinc-800 text-zinc-300 border border-zinc-700 font-semibold">
              {filteredTransactions.length} records
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Master financial ledger reconciled chronologically via state reducer consensus.
          </p>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search ID, customer, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-3.5 h-10 text-sm rounded-xl bg-zinc-950 border border-zinc-800 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 w-52 md:w-64 transition-all"
            />
          </div>

          <div className="flex items-center rounded-xl bg-zinc-950 border border-zinc-800 p-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-zinc-500 ml-1.5 mr-1" />
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'ALL' ? 'bg-zinc-800 text-zinc-100 font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-100'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('SUCCESS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'SUCCESS' ? 'bg-zinc-800 text-emerald-400 font-semibold shadow-sm' : 'text-zinc-400 hover:text-emerald-400'
              }`}
            >
              Success
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('MANUAL_REVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === 'MANUAL_REVIEW' ? 'bg-zinc-800 text-amber-400 font-semibold shadow-sm' : 'text-zinc-400 hover:text-amber-400'
              }`}
            >
              Review
            </button>
          </div>
        </div>
      </div>

      {/* Table Data Grid with High Legibility & Zero Overflow */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse min-w-[980px]">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950/80 font-mono text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              <th className="py-4 px-6 w-[26%]">Transaction ID</th>
              <th className="py-4 px-6 w-[18%]">Customer</th>
              <th className="py-4 px-6 w-[15%]">Amount (INR)</th>
              <th className="py-4 px-6 w-[9%]">Currency</th>
              <th className="py-4 px-6 w-[16%]">Status</th>
              <th className="py-4 px-6 w-[8%]">Events</th>
              <th className="py-4 px-6 w-[8%] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80 text-sm">
            {isLoading && transactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-zinc-400 text-sm">
                  <div className="inline-block w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="font-mono text-sm text-zinc-300">Connecting to PostgreSQL master ledger...</p>
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-16 text-center text-zinc-400 font-mono text-sm">
                  No matching transaction records found.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx) => (
                <tr
                  key={tx.id}
                  onClick={() => onSelectTransaction(tx)}
                  className="hover:bg-zinc-800/40 transition-colors cursor-pointer group"
                >
                  {/* Transaction ID */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-2 max-w-[280px]">
                      <span className="font-mono text-sm text-zinc-200 font-medium truncate" title={tx.id}>
                        {tx.id}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleCopy(tx.id, e)}
                        title="Copy ID"
                        className="p-1 rounded hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      >
                        {copiedId === tx.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>

                  {/* Customer */}
                  <td className="py-4 px-6 text-zinc-200 font-medium text-sm">
                    <span className="truncate block max-w-[190px]" title={tx.customer}>
                      {tx.customer}
                    </span>
                  </td>

                  {/* Amount in Indian Rupees */}
                  <td className="py-4 px-6 font-mono text-base font-bold text-emerald-400 tabular-nums whitespace-nowrap">
                    ₹{Number(tx.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>

                  {/* Currency Badge */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 font-semibold">
                      {tx.currency === 'USD' ? 'INR' : (tx.currency || 'INR')}
                    </span>
                  </td>

                  {/* Status Badge */}
                  <td className="py-4 px-6 whitespace-nowrap">
                    {getStatusBadge(tx.derivedStatus)}
                  </td>

                  {/* Audit Event Count */}
                  <td className="py-4 px-6 font-mono text-xs text-zinc-400 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded bg-zinc-800/80 text-zinc-300 font-medium border border-zinc-700/60">
                        {tx.eventCount} log{tx.eventCount !== 1 ? 's' : ''}
                      </span>
                      {tx.hasConflict && (
                        <span className="text-xs text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Conflict
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTransaction(tx);
                      }}
                      className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 font-medium text-xs transition-all shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Inspect</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
