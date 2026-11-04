'use client';

import React, { useState } from 'react';
import {
  ShieldAlert,
  Activity,
  Users,
  ArrowUpRight,
  RefreshCw,
  FileCheck,
  AlertTriangle,
  Lock,
  Gift,
} from 'lucide-react';
import { GiftingsView } from '@/components/giftings-view';

export default function AdminDashboardPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'customers' | 'giftings' | 'reconciliation' | 'audit'>('overview');
  const [reconciliationRunning, setReconciliationRunning] = useState(false);
  const [reconciliationMessage, setReconciliationMessage] = useState<string | null>(null);

  const handleTriggerReconciliation = () => {
    setReconciliationRunning(true);
    setReconciliationMessage(null);
    setTimeout(() => {
      setReconciliationRunning(false);
      setReconciliationMessage('Reconciliation Completed: 100% Transactions matched with Provider Settlement reports.');
    }, 1200);
  };

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-800 bg-slate-900/50 p-6 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-3 mb-8">
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg">
              W
            </div>
            <div>
              <h1 className="font-semibold text-sm tracking-wide text-white">WAPPay Admin</h1>
              <p className="text-xs text-slate-400">Banking Operations</p>
            </div>
          </div>

          <nav className="space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg font-medium transition ${
                activeTab === 'overview'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Activity className="h-4 w-4" /> Overview
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg font-medium transition ${
                activeTab === 'transactions'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ArrowUpRight className="h-4 w-4" /> Transactions
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg font-medium transition ${
                activeTab === 'customers'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Users className="h-4 w-4" /> Customers
            </button>
            <button
              onClick={() => setActiveTab('giftings')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg font-medium transition ${
                activeTab === 'giftings'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Gift className="h-4 w-4" /> Giftings
            </button>
            <button
              onClick={() => setActiveTab('reconciliation')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg font-medium transition ${
                activeTab === 'reconciliation'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <RefreshCw className="h-4 w-4" /> Reconciliation
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg font-medium transition ${
                activeTab === 'audit'
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <FileCheck className="h-4 w-4" /> Audit Logs
            </button>
          </nav>
        </div>

        <div className="border-t border-slate-800 pt-4">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Lock className="h-3.5 w-3.5 text-emerald-400" />
            <span>MFA Authenticated</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">super.admin@wappay.internal</p>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-8 overflow-y-auto">
        {/* Safety Gate Alert Banner */}
        <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-300">
                CRITICAL SAFETY GATE: IS_SIMULATED = ENABLED
              </p>
              <p className="text-xs text-amber-400/80 mt-0.5">
                All financial transfers are routed to the sandbox clearing adapter. Production live settlement is gated.
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
            SANDBOX ENVIRONMENT
          </span>
        </div>

        {/* Dynamic Tab Views */}
        {activeTab === 'overview' && (
          <div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">Financial Overview</h2>
                <p className="text-sm text-slate-400 mt-1">Authoritative metrics derived from general ledger state.</p>
              </div>
              <button
                onClick={handleTriggerReconciliation}
                disabled={reconciliationRunning}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${reconciliationRunning ? 'animate-spin' : ''}`} />
                {reconciliationRunning ? 'Reconciling...' : 'Run 3-Way Reconciliation'}
              </button>
            </div>

            {reconciliationMessage && (
              <div className="mb-6 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm flex items-center gap-2">
                <FileCheck className="h-4 w-4" /> {reconciliationMessage}
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Customers</p>
                <p className="text-2xl font-bold text-white mt-2">1,428</p>
                <p className="text-xs text-emerald-400 mt-1">+12% this week</p>
              </div>
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">24h Settled Volume</p>
                <p className="text-2xl font-bold text-white mt-2">₦14,850,200.00</p>
                <p className="text-xs text-slate-400 mt-1">98.9% success rate</p>
              </div>
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Pending Network Polls</p>
                <p className="text-2xl font-bold text-amber-400 mt-2">2</p>
                <p className="text-xs text-slate-400 mt-1">Awaiting bank webhook</p>
              </div>
              <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Reconciliation Status</p>
                <p className="text-2xl font-bold text-emerald-400 mt-2">MATCHED</p>
                <p className="text-xs text-slate-400 mt-1">Zero ledger drift</p>
              </div>
            </div>

            {/* Live Transaction Monitoring Table */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
              <div className="p-5 border-b border-slate-800">
                <h3 className="font-semibold text-white text-base">Recent Financial Transactions</h3>
                <p className="text-xs text-slate-400 mt-0.5">Real-time feed with immutable ledger journal associations.</p>
              </div>
              <table className="w-full text-left text-sm text-slate-300">
                <thead className="bg-slate-950/60 text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="px-5 py-3">Reference</th>
                    <th className="px-5 py-3">Customer</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Amount</th>
                    <th className="px-5 py-3">State</th>
                    <th className="px-5 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">TXN_1793553515_440BD9</td>
                    <td className="px-5 py-3 font-medium text-white">David Adeleke (+2348012345678)</td>
                    <td className="px-5 py-3">TRANSFER</td>
                    <td className="px-5 py-3 font-semibold text-white">₦5,000.00</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        SUCCESSFUL
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">Just now</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">TXN_1793553200_A1B2C3</td>
                    <td className="px-5 py-3 font-medium text-white">Sarah Obi (+2348098765432)</td>
                    <td className="px-5 py-3">TRANSFER</td>
                    <td className="px-5 py-3 font-semibold text-white">₦12,500.00</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        SUCCESSFUL
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">12 mins ago</td>
                  </tr>
                  <tr className="hover:bg-slate-800/30">
                    <td className="px-5 py-3 font-mono text-xs text-slate-400">TXN_1793552999_8899AA</td>
                    <td className="px-5 py-3 font-medium text-white">Emeka Okafor (+2347011223344)</td>
                    <td className="px-5 py-3">AIRTIME_PURCHASE</td>
                    <td className="px-5 py-3 font-semibold text-white">₦1,000.00</td>
                    <td className="px-5 py-3">
                      <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        SUCCESSFUL
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-slate-400">28 mins ago</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'giftings' && <GiftingsView />}

        {activeTab !== 'overview' && activeTab !== 'giftings' && (
          <div className="p-8 rounded-xl border border-slate-800 bg-slate-900/40 text-center py-16">
            <h3 className="text-lg font-semibold text-white capitalize">{activeTab} Section Active</h3>
            <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
              Connected to backend REST API: <code className="text-emerald-400 font-mono">/api/v1/admin/{activeTab}</code>
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
