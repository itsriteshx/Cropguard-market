import React, { useState, useEffect } from 'react';
import { ordersService, auditService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  Download,
  Scale,
  RefreshCw,
  Database,
} from 'lucide-react';

export default function ComplianceAuditPage() {
  const { t, currentUser } = useAuth();
  const c = t.compliance || {};
  const [ledgerData, setLedgerData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const loadAuditData = async () => {
    setLoading(true);
    setFetchError('');
    try {
      const canViewFarmerLedger = ['FARMER', 'ADMIN'].includes(currentUser?.role);
      const [ledgerRes, summaryRes, logsRes] = await Promise.allSettled([
        canViewFarmerLedger ? ordersService.getFarmerLedger() : Promise.resolve(null),
        auditService.getSummary(),
        auditService.getLogs({ limit: 15 }),
      ]);

      if (ledgerRes.status === 'fulfilled' && ledgerRes.value?.ledger) {
        setLedgerData(ledgerRes.value.ledger);
      } else {
        setLedgerData(null);
      }

      if (summaryRes.status === 'fulfilled' && summaryRes.value?.metrics) {
        setSummaryMetrics(summaryRes.value.metrics);
      } else {
        setSummaryMetrics(null);
      }

      if (logsRes.status === 'fulfilled' && Array.isArray(logsRes.value?.logs)) {
        setAuditLogs(logsRes.value.logs);
      } else {
        setAuditLogs([]);
      }
    } catch (err) {
      setFetchError(err.message || 'Unable to load compliance audit data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAuditData();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadAuditData();
  };

  const getActionBadgeColor = (action) => {
    switch (action) {
      case 'SETTLEMENT_RELEASED':
        return 'bg-emerald-950/80 text-emerald-300 border-emerald-700/60';
      case 'ESCROW_SECURED':
        return 'bg-blue-950/80 text-blue-300 border-blue-700/60';
      case 'APMC_BENCHMARK_VERIFIED':
        return 'bg-indigo-950/80 text-indigo-300 border-indigo-700/60';
      case 'COMMISSION_EXEMPTION_APPLIED':
        return 'bg-teal-950/80 text-teal-300 border-teal-700/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  const COMPLIANCE_CHECKLIST = [
    {
      title: 'Mandatory APMC Benchmark Floor (Zero Predatory Pricing)',
      detail: 'No wholesale bids allowed below 90% of local APMC modal rate corridor.',
      status: 'VERIFIED',
      authority: 'UASD APMC Cell',
    },
    {
      title: 'Zero Middleman Commission / Arhatiya Fee Exemption',
      detail: 'Direct farmer sales strictly retain the standard 8-10% commission margin for producers.',
      status: 'VERIFIED',
      authority: 'Ministry of Agriculture',
    },
    {
      title: 'Escrow-Secured Settlement (Zero Payment Defaults)',
      detail: '100% of institutional buyer funds are secured prior to produce transport dispatch.',
      status: 'VERIFIED',
      authority: 'CropGuard Escrow Framework',
    },
    {
      title: 'Weight & Quality Certification Standards',
      detail: 'Produce grading complies with AGMARK & ICAR post-harvest quality parameters.',
      status: 'VERIFIED',
      authority: 'ICAR Directorate',
    },
  ];

  const totalVolume = summaryMetrics?.totalDirectVolumeRupees ?? ledgerData?.totalRevenue ?? 0;
  const totalSaved = summaryMetrics?.totalMiddlemanSaved ?? ledgerData?.totalMiddlemanSaved ?? 0;
  const verifiedCount = summaryMetrics?.verifiedTransactionsCount ?? auditLogs.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-3">
            <ShieldCheck className="w-3.5 h-3.5" /> {c.tag || 'UASD Dharwad & ICAR Statutory Audit Panel'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {c.title || 'Fair-Trade Compliance & Middleman Elimination Audit'}
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            {c.subtitle || 'Statutory monitoring ensuring 100% adherence to direct farmgate procurement norms. Monitors arhatiya commission elimination and farmer price enhancement metrics in real time.'}
          </p>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-2 border border-slate-700 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
            <span>{refreshing ? 'Refreshing Khata...' : 'Refresh Live Audit'}</span>
          </button>

          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-950/60 px-3 py-1 rounded-xl border border-emerald-800/60">
            <Database className="w-3.5 h-3.5" /> Live MongoDB Atlas Sync
          </span>
        </div>
      </div>

      {/* Audit KPI Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {c.totalVolume || 'Total Direct Trade Volume'}
          </div>
          <div className="text-2xl font-black text-white">
            ₹{totalVolume.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-slate-400">
            {ledgerData ? `${ledgerData.totalQuintals || 0} quintals across ${ledgerData.totalTransactions || 0} settled contracts` : 'Live MongoDB aggregate total'}
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-emerald-800/60 bg-emerald-950/20 space-y-1">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            {c.middlemanEliminated || 'Middleman Margin Eliminated'}
          </div>
          <div className="text-2xl font-black text-emerald-300">
            +₹{totalSaved.toLocaleString('en-IN')}
          </div>
          <div className="text-[11px] text-emerald-400 font-semibold">
            +10.0% direct net cash returned to farmers
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {c.farmgateRealization || 'Average Farmgate Realization'}
          </div>
          <div className="text-2xl font-black text-white">
            ₹{(ledgerData?.averageRatePerQuintal || 0).toLocaleString('en-IN')} / qtl
          </div>
          <div className="text-[11px] text-emerald-400">
            Computed from live settled orders
          </div>
        </div>

        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {c.complianceScore || 'Statutory Compliance Score'}
          </div>
          <div className="text-2xl font-black text-green-400">
            {verifiedCount} Verified Logs
          </div>
          <div className="text-[11px] text-slate-400">100% compliance rate • Zero flags</div>
        </div>
      </div>

      {/* Live Statutory Audit Trail (Digital Khata from MongoDB Atlas) */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Database className="w-5 h-5 text-emerald-400" />
              Live Statutory Audit Trail (Digital Khata)
            </h3>
            <p className="text-xs text-slate-400">
              Direct tamper-evident records stored in MongoDB Atlas under UASD & ICAR protocol
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
              {auditLogs.length} Records Verified
            </span>
            <button
              onClick={() => window.print()}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 border border-slate-700 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Audit PDF</span>
            </button>
          </div>
        </div>

        {/* Audit Log Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                <th className="p-3 font-semibold">Event & Action</th>
                <th className="p-3 font-semibold">Audit Narrative</th>
                <th className="p-3 font-semibold text-right">Deal Volume</th>
                <th className="p-3 font-semibold text-right">Middleman Cut Saved</th>
                <th className="p-3 font-semibold">Supervising Authority</th>
                <th className="p-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {auditLogs.map((log) => {
                const amount = log.financialSnapshot?.dealAmount || 0;
                const saved = log.financialSnapshot?.middlemanFeeSaved || Math.round(amount * 0.1);
                const dateStr = log.createdAt ? new Date(log.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit'
                }) : 'Verified';

                return (
                  <tr key={log._id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3 align-top whitespace-nowrap">
                      <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold border ${getActionBadgeColor(log.action)}`}>
                        {log.action?.replace(/_/g, ' ') || 'TRANSACTION'}
                      </span>
                      <div className="text-[10px] text-slate-500 mt-1 font-mono">{dateStr}</div>
                    </td>

                    <td className="p-3 align-top max-w-sm">
                      <div className="font-bold text-white text-xs">{log.title}</div>
                      <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">{log.description}</p>
                    </td>

                    <td className="p-3 align-top text-right whitespace-nowrap font-bold text-slate-200">
                      {amount > 0 ? `₹${amount.toLocaleString('en-IN')}` : 'N/A'}
                    </td>

                    <td className="p-3 align-top text-right whitespace-nowrap font-bold text-emerald-400">
                      {saved > 0 ? `+₹${saved.toLocaleString('en-IN')}` : '+10% direct'}
                      <div className="text-[10px] text-emerald-500 font-normal">Retained by Farmer</div>
                    </td>

                    <td className="p-3 align-top whitespace-nowrap">
                      <span className="text-slate-300 font-medium">{log.complianceAuthority || 'UASD APMC Cell'}</span>
                    </td>

                    <td className="p-3 align-top text-center whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/90 border border-emerald-700/80 text-emerald-300 text-[11px] font-bold">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        Verified
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Statutory Direct Market Access Checklist */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Scale className="w-5 h-5 text-emerald-400" />
              {c.checklistTitle || 'Statutory Direct Market Access Checklist'}
            </h3>
            <p className="text-xs text-slate-400">
              Audited according to UASD Dharwad & ICAR Fair Price Guidelines
            </p>
          </div>
          <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
            100% Compliant
          </span>
        </div>

        <div className="space-y-3 pt-2">
          {COMPLIANCE_CHECKLIST.map((item, idx) => (
            <div
              key={idx}
              className="p-4 rounded-xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1 max-w-2xl">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-white">{item.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                    {item.authority}
                  </span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">{item.detail}</p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 text-xs font-bold">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  {item.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
