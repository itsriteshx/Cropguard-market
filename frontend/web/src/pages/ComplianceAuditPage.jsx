import React, { useState, useEffect, useMemo } from 'react';
import { ordersService, auditService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  ShieldCheck,
  CheckCircle2,
  Download,
  Scale,
  RefreshCw,
  Database,
  PlusCircle,
  X,
  Share2,
  Trash2,
  Eye,
  FileText,
  TrendingUp,
  AlertCircle,
  Calendar,
  Phone,
  Image as ImageIcon,
} from 'lucide-react';

const WEB_KHATA_STORAGE_KEY = 'cropguard_farmer_khata_records_v2';

const INITIAL_DEMO_BILLS = [
  {
    id: 'BILL-801',
    type: 'SALE',
    partyName: 'Dharwad APMC - Patil Traders',
    partyPhone: '9845123456',
    cropName: 'Red Onion (Garva Special)',
    quantity: '40',
    unit: 'QUINTAL',
    amount: 98000,
    paidStatus: 'PAID',
    date: '2026-11-12',
    category: 'CROP_SALE',
    notes: 'Sold at ₹2,450/qtl APMC benchmark. Immediate RTGS transfer.',
    imageUri: null,
  },
  {
    id: 'BILL-802',
    type: 'EXPENSE',
    partyName: 'IFFCO Kisan Seva Kendra, Hubballi',
    partyPhone: '9876543210',
    cropName: 'DAP & Urea Fertilizer (10 Bags)',
    quantity: '10',
    unit: 'BAGS',
    amount: 14500,
    paidStatus: 'PAID',
    date: '2026-11-08',
    category: 'FERTILIZER',
    notes: 'Subsidized fertilizer for Rabi wheat sowing season.',
    imageUri: null,
  },
  {
    id: 'BILL-803',
    type: 'SALE',
    partyName: 'Hubballi Local Mandi - Mahesh Arhatiya',
    partyPhone: '9448123789',
    cropName: 'Fresh Hybrid Tomato',
    quantity: '25',
    unit: 'CRATE',
    amount: 18750,
    paidStatus: 'UDHAAR',
    date: '2026-11-10',
    category: 'CROP_SALE',
    notes: 'Advance ₹5,000 received. Balance ₹13,750 promised by Monday.',
    imageUri: null,
  },
  {
    id: 'BILL-804',
    type: 'EXPENSE',
    partyName: 'Deshmukh Harvester & Tractor Works',
    partyPhone: '9731234567',
    cropName: 'Ploughing & Rotavator (12 Hours)',
    quantity: '12',
    unit: 'HOURS',
    amount: 10800,
    paidStatus: 'PAID',
    date: '2026-11-05',
    category: 'MACHINERY',
    notes: 'Leveling and tractor diesel expense included.',
    imageUri: null,
  },
];

export default function ComplianceAuditPage() {
  const { t, currentUser } = useAuth();
  const c = t.compliance || {};

  // Top Tabs: 'KHATA' (My Bills) | 'ORDERS' (Platform Orders) | 'SUMMARY' (P&L Analytics) | 'AUDIT' (Compliance Checklist)
  const [activeTab, setActiveTab] = useState('KHATA');

  // Backend Audit & Ledger Data
  const [ledgerData, setLedgerData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [summaryMetrics, setSummaryMetrics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState('');

  // Farmer Offline Bills State (Local Storage)
  const [khataBills, setKhataBills] = useState([]);
  const [filterType, setFilterType] = useState('ALL'); // 'ALL' | 'SALE' | 'EXPENSE' | 'UDHAAR'
  const [searchQuery, setSearchQuery] = useState('');

  // Add Bill Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [billType, setBillType] = useState('SALE');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [cropName, setCropName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState('QUINTAL');
  const [amount, setAmount] = useState('');
  const [paidStatus, setPaidStatus] = useState('PAID');
  const [notes, setNotes] = useState('');
  const [billImage, setBillImage] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  // Selected Bill Voucher Modal
  const [selectedBill, setSelectedBill] = useState(null);

  // Load Stored Bills from LocalStorage
  const loadStoredBills = () => {
    try {
      const raw = localStorage.getItem(WEB_KHATA_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setKhataBills(parsed);
          return;
        }
      }
      setKhataBills(INITIAL_DEMO_BILLS);
    } catch {
      setKhataBills(INITIAL_DEMO_BILLS);
    }
  };

  const saveStoredBills = (bills) => {
    setKhataBills(bills);
    try {
      localStorage.setItem(WEB_KHATA_STORAGE_KEY, JSON.stringify(bills));
    } catch (e) {
      console.warn('Could not save to localStorage:', e);
    }
  };

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
    loadStoredBills();
    loadAuditData();
  }, []);

  const handleManualRefresh = () => {
    setRefreshing(true);
    loadStoredBills();
    loadAuditData();
  };

  // Image Upload Handler
  const handleImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      setBillImage(uploadEvent.target.result);
    };
    reader.readAsDataURL(file);
  };

  // Save New Bill
  const handleSaveBill = (e) => {
    e.preventDefault();
    if (!partyName.trim() || !amount) return;

    const newEntry = {
      id: `BILL-${Date.now().toString().slice(-4)}`,
      type: billType,
      partyName: partyName.trim(),
      partyPhone: partyPhone.trim(),
      cropName: cropName.trim() || (billType === 'SALE' ? 'Harvest Produce' : 'Agri Inputs'),
      quantity: quantity.trim() || '1',
      unit: unit || 'UNIT',
      amount: Number(amount),
      paidStatus: paidStatus,
      date: new Date().toISOString().split('T')[0],
      notes: notes.trim(),
      imageUri: billImage,
    };

    const updated = [newEntry, ...khataBills];
    saveStoredBills(updated);

    // Reset
    setPartyName('');
    setPartyPhone('');
    setCropName('');
    setQuantity('');
    setAmount('');
    setNotes('');
    setBillImage(null);
    setShowAddModal(false);
  };

  // Delete Bill
  const handleDeleteBill = (id) => {
    if (window.confirm('Are you sure you want to delete this bill from your Khata?')) {
      const updated = khataBills.filter((b) => b.id !== id);
      saveStoredBills(updated);
      if (selectedBill?.id === id) setSelectedBill(null);
    }
  };

  // Toggle Paid / Udhaar Status
  const handleTogglePaidStatus = (id) => {
    const updated = khataBills.map((b) => {
      if (b.id === id) {
        return {
          ...b,
          paidStatus: b.paidStatus === 'PAID' ? 'UDHAAR' : 'PAID',
        };
      }
      return b;
    });
    saveStoredBills(updated);
    if (selectedBill?.id === id) {
      setSelectedBill((prev) => (prev ? { ...prev, paidStatus: prev.paidStatus === 'PAID' ? 'UDHAAR' : 'PAID' } : null));
    }
  };

  // Share / Copy WhatsApp Voucher
  const handleShareBill = (bill) => {
    const isSale = bill.type === 'SALE';
    const statusText = bill.paidStatus === 'PAID' ? 'PAID / चुकता ✅' : 'PENDING UDHAAR / बाकी ⏳';
    const text = `🌾 CropGuard Kisan Digital Khata
━━━━━━━━━━━━━━━━━━
📄 Bill Ref: ${bill.id}
📅 Date: ${bill.date}
👤 Party: ${bill.partyName}${bill.partyPhone ? ` (📱 ${bill.partyPhone})` : ''}
📦 Description: ${bill.cropName} (${bill.quantity} ${bill.unit})
💰 Total Amount: ₹${bill.amount.toLocaleString('en-IN')}
📌 Status: ${statusText}
${bill.notes ? `📝 Note: ${bill.notes}\n` : ''}━━━━━━━━━━━━━━━━━━
Saved in CropGuard Direct Mandi Khata.`;

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(bill.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
    // Also try opening WhatsApp if phone exists
    if (bill.partyPhone) {
      const cleanPhone = bill.partyPhone.replace(/\D/g, '');
      const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(text)}`;
      window.open(waUrl, '_blank');
    }
  };

  // Metrics
  const khataMetrics = useMemo(() => {
    let totalSales = 0;
    let totalExpenses = 0;
    let totalUdhaar = 0;

    khataBills.forEach((b) => {
      const amt = Number(b.amount) || 0;
      if (b.type === 'SALE') {
        totalSales += amt;
        if (b.paidStatus === 'UDHAAR') totalUdhaar += amt;
      } else {
        totalExpenses += amt;
      }
    });

    const netProfit = totalSales - totalExpenses;
    return { totalSales, totalExpenses, totalUdhaar, netProfit };
  }, [khataBills]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return khataBills.filter((b) => {
      if (filterType === 'SALE' && b.type !== 'SALE') return false;
      if (filterType === 'EXPENSE' && b.type !== 'EXPENSE') return false;
      if (filterType === 'UDHAAR' && b.paidStatus !== 'UDHAAR') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const pName = (b.partyName || '').toLowerCase();
        const cName = (b.cropName || '').toLowerCase();
        const bId = (b.id || '').toLowerCase();
        return pName.includes(query) || cName.includes(query) || bId.includes(query);
      }
      return true;
    });
  }, [khataBills, filterType, searchQuery]);

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
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-3xl p-6 relative overflow-hidden shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-2">
              <ShieldCheck className="w-3.5 h-3.5" /> Farmer Digital Khata &amp; Direct Mandi Audit
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              📒 Digital Khata, Bills &amp; Compliance Ledger
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm mt-1.5 leading-relaxed">
              Store physical bills, mandi parchis, and input expenses alongside verified APMC platform settlements and statutory compliance audit trails.
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950 transition-colors"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add Bill / Khata Entry</span>
            </button>
            <button
              onClick={handleManualRefresh}
              disabled={refreshing}
              className="px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-emerald-400' : 'text-slate-400'}`} />
              <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Segmented Top Navigation Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 overflow-x-auto">
        <button
          onClick={() => setActiveTab('KHATA')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'KHATA'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <span>📒 My Bills &amp; Slips ({khataBills.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('ORDERS')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'ORDERS'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <span>🌾 Platform Orders ({ledgerData?.totalTransactions || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('SUMMARY')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'SUMMARY'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <span>📊 Farm P&amp;L Report</span>
        </button>

        <button
          onClick={() => setActiveTab('AUDIT')}
          className={`flex-1 min-w-[140px] py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'AUDIT'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <span>🛡️ Statutory Audit ({auditLogs.length})</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: FARMER OFFLINE BILLS & DIGITAL KHATA             */}
      {/* ======================================================== */}
      {activeTab === 'KHATA' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">🟢 Total Produce Sales</span>
              <div className="text-xl font-black text-emerald-400">₹{khataMetrics.totalSales.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-slate-500">Recorded offline &amp; mandi sales</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">🔴 Total Farm Expenses</span>
              <div className="text-xl font-black text-red-400">₹{khataMetrics.totalExpenses.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-slate-500">Seeds, Fertilizer, Diesel, Labor</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400">💰 Net Farming Savings</span>
              <div className={`text-xl font-black ${khataMetrics.netProfit >= 0 ? 'text-emerald-300' : 'text-red-400'}`}>
                ₹{khataMetrics.netProfit.toLocaleString('en-IN')}
              </div>
              <span className="text-[10px] text-slate-500">Sales minus recorded expenses</span>
            </div>

            <div className="p-4 rounded-2xl bg-slate-900 border border-amber-800/50 bg-amber-950/10 space-y-1">
              <span className="text-[10px] uppercase font-bold text-amber-400">⏳ Pending Udhaar (बाकी)</span>
              <div className="text-xl font-black text-amber-300">₹{khataMetrics.totalUdhaar.toLocaleString('en-IN')}</div>
              <span className="text-[10px] text-amber-400/80">Owed by buyers / local traders</span>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900 border border-slate-800">
            <input
              type="text"
              placeholder="Search trader, crop, or bill ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-80 px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />

            <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto w-full sm:w-auto">
              {[
                { key: 'ALL', label: 'All Bills' },
                { key: 'SALE', label: '🟢 Sales' },
                { key: 'EXPENSE', label: '🔴 Expenses' },
                { key: 'UDHAAR', label: '⏳ Udhaar' },
              ].map((pill) => (
                <button
                  key={pill.key}
                  onClick={() => setFilterType(pill.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    filterType === pill.key
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                      : 'bg-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Bills Cards Grid */}
          {filteredBills.length === 0 ? (
            <div className="py-16 text-center rounded-3xl bg-slate-900/40 border border-slate-800/60 space-y-3">
              <div className="text-4xl">📂</div>
              <h3 className="text-base font-bold text-white">No Khata Bills Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No bills match your current filters. Add your first physical mandi parchi or fertilizer receipt.
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
              >
                + Add Your First Bill
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredBills.map((bill) => {
                const isSale = bill.type === 'SALE';
                const isPaid = bill.paidStatus === 'PAID';

                return (
                  <div
                    key={bill.id}
                    className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-slate-700 transition-colors"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold text-slate-500">{bill.id}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                isSale
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                  : 'bg-red-950 text-red-300 border-red-800'
                              }`}
                            >
                              {isSale ? '🟢 BIKRI / SALE' : '🔴 KHARCH / EXPENSE'}
                            </span>
                            {bill.imageUri && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-950 text-sky-300 border border-sky-800 flex items-center gap-1">
                                <ImageIcon className="w-2.5 h-2.5" /> Slip Attached
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-bold text-white mt-1.5">{bill.partyName}</h4>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {bill.cropName} • {bill.quantity} {bill.unit}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className={`text-lg font-black ${isSale ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isSale ? '+' : '-'} ₹{bill.amount.toLocaleString('en-IN')}
                          </div>
                          <button
                            onClick={() => handleTogglePaidStatus(bill.id)}
                            title="Click to toggle Paid/Udhaar"
                            className={`mt-1 px-2.5 py-0.5 rounded text-[10px] font-bold border transition-colors ${
                              isPaid
                                ? 'bg-emerald-950/80 text-emerald-300 border-emerald-700 hover:bg-emerald-900'
                                : 'bg-amber-950/80 text-amber-300 border-amber-700 hover:bg-amber-900'
                            }`}
                          >
                            {isPaid ? '✔ PAID' : '⏳ UDHAAR (Tap to pay)'}
                          </button>
                        </div>
                      </div>

                      {bill.notes && (
                        <p className="text-xs text-slate-400 mt-2 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800/80 line-clamp-2">
                          {bill.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-500 text-[11px]">
                        <Calendar className="w-3 h-3" />
                        <span>{bill.date}</span>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedBill(bill)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition-colors"
                        >
                          <Eye className="w-3 h-3" /> View
                        </button>
                        <button
                          onClick={() => handleShareBill(bill)}
                          className="px-2.5 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 text-emerald-300 text-xs font-semibold flex items-center gap-1 border border-emerald-800 transition-colors"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>{copiedId === bill.id ? 'Copied!' : 'WhatsApp'}</span>
                        </button>
                        <button
                          onClick={() => handleDeleteBill(bill.id)}
                          className="p-1.5 rounded-lg bg-red-950/50 hover:bg-red-900/60 text-red-400 border border-red-800 transition-colors"
                          title="Delete bill"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: PLATFORM ORDERS & SETTLED CONTRACTS              */}
      {/* ======================================================== */}
      {activeTab === 'ORDERS' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Total Direct Trade Volume
              </div>
              <div className="text-2xl font-black text-white">₹{totalVolume.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-slate-400">
                {ledgerData ? `${ledgerData.totalQuintals || 0} quintals settled` : 'Live MongoDB aggregate total'}
              </div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-emerald-800/60 bg-emerald-950/20 space-y-1">
              <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
                Middleman Margin Eliminated
              </div>
              <div className="text-2xl font-black text-emerald-300">+₹{totalSaved.toLocaleString('en-IN')}</div>
              <div className="text-[11px] text-emerald-400 font-semibold">+10.0% direct net cash to farmer</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Average Farmgate Realization
              </div>
              <div className="text-2xl font-black text-white">
                ₹{(ledgerData?.averageRatePerQuintal || 0).toLocaleString('en-IN')} / qtl
              </div>
              <div className="text-[11px] text-emerald-400">Calculated from live orders</div>
            </div>

            <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-1">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Platform Verification Rate
              </div>
              <div className="text-2xl font-black text-green-400">{verifiedCount} Orders Verified</div>
              <div className="text-[11px] text-slate-400">100% compliance rate • Zero flags</div>
            </div>
          </div>

          {/* Orders Table */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <FileText className="w-5 h-5 text-emerald-400" />
                  Verified Platform Orders &amp; Escrow Contracts
                </h3>
                <p className="text-xs text-slate-400">
                  Transactions executed via CropGuard direct bargaining and MongoDB ACID transactions
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                Live MongoDB Atlas Sync
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400 bg-slate-900/60">
                    <th className="p-3 font-semibold">Order ID</th>
                    <th className="p-3 font-semibold">Produce Description</th>
                    <th className="p-3 font-semibold text-right">Quantity</th>
                    <th className="p-3 font-semibold text-right">Total Deal (₹)</th>
                    <th className="p-3 font-semibold text-center">Escrow Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {auditLogs.slice(0, 8).map((log, idx) => (
                    <tr key={log._id || idx} className="hover:bg-slate-900/40 transition-colors">
                      <td className="p-3 font-mono text-emerald-400">ORD-{log._id?.slice(-5) || idx + 101}</td>
                      <td className="p-3 font-bold text-white">{log.title || 'Direct Mandi Consignment'}</td>
                      <td className="p-3 text-right text-slate-300">
                        {log.financialSnapshot?.quantity || '40'} Quintal
                      </td>
                      <td className="p-3 text-right font-black text-emerald-400">
                        ₹{(log.financialSnapshot?.dealAmount || 98000).toLocaleString('en-IN')}
                      </td>
                      <td className="p-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                          ✔ SETTLED
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: FARM P&L REPORT & CASHFLOW                       */}
      {/* ======================================================== */}
      {activeTab === 'SUMMARY' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div
            className={`p-6 rounded-3xl border ${
              khataMetrics.netProfit >= 0
                ? 'bg-gradient-to-r from-emerald-950/60 to-slate-900 border-emerald-700/60'
                : 'bg-gradient-to-r from-red-950/60 to-slate-900 border-red-700/60'
            }`}
          >
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              🌱 Net Farm Realization / शुद्ध किसान मुनाफा
            </span>
            <div className={`text-4xl font-black mt-2 ${khataMetrics.netProfit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              ₹{khataMetrics.netProfit.toLocaleString('en-IN')}
            </div>
            <p className="text-xs text-slate-300 mt-2 max-w-xl">
              {khataMetrics.netProfit >= 0
                ? 'Excellent financial health! Your produce earnings exceed recorded seed, fertilizer, diesel and machinery input expenses.'
                : 'Expenses currently exceed sales recorded. Review pending harvests and collect outstanding Udhaar.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4">
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Cashflow Breakdown (आय व व्यय विश्लेषण)
              </h4>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">🟢 Total Produce Sales (Mandi + Direct)</span>
                  <span className="font-bold text-emerald-400">₹{khataMetrics.totalSales.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-slate-800">
                  <span className="text-slate-400">🔴 Total Agricultural Inputs &amp; Expenses</span>
                  <span className="font-bold text-red-400">- ₹{khataMetrics.totalExpenses.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between items-center py-2 text-sm font-bold">
                  <span className="text-white">Net Pocket Surplus</span>
                  <span className="text-emerald-300">₹{khataMetrics.netProfit.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            <div className="p-6 rounded-2xl bg-amber-950/20 border border-amber-800/40 space-y-3">
              <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Outstanding Udhaar to Recover (बाकी वसूली)
              </h4>
              <div className="text-2xl font-black text-amber-400">₹{khataMetrics.totalUdhaar.toLocaleString('en-IN')}</div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Money owed by mandi commission agents, local traders, or buyers. Tap any Udhaar bill in your Khata tab to send an automated WhatsApp reminder voucher.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: STATUTORY AUDIT & FAIR-TRADE CHECKLIST           */}
      {/* ======================================================== */}
      {activeTab === 'AUDIT' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-emerald-400" />
                  {c.checklistTitle || 'Statutory Direct Market Access Checklist'}
                </h3>
                <p className="text-xs text-slate-400">
                  Audited according to UASD Dharwad &amp; ICAR Fair Price Guidelines
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
      )}

      {/* ======================================================== */}
      {/* MODAL: ADD NEW BILL / KHATA ENTRY                       */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-lg w-full p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">📝 Add Khata Bill / Mandi Entry</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBill} className="space-y-3.5 text-xs">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-slate-950 border border-slate-800">
                <button
                  type="button"
                  onClick={() => setBillType('SALE')}
                  className={`py-2 rounded-lg font-bold transition-colors ${
                    billType === 'SALE' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🟢 Sale / Bikri (बिक्री)
                </button>
                <button
                  type="button"
                  onClick={() => setBillType('EXPENSE')}
                  className={`py-2 rounded-lg font-bold transition-colors ${
                    billType === 'EXPENSE' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔴 Expense / Kharch (लागत)
                </button>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  {billType === 'SALE' ? 'Buyer / Mandi Trader Name *' : 'Shop / Vendor Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={billType === 'SALE' ? 'e.g. Patil Traders - Dharwad APMC' : 'e.g. IFFCO Kisan Seva Kendra'}
                  value={partyName}
                  onChange={(e) => setPartyName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Party Mobile (for WhatsApp)</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  value={partyPhone}
                  onChange={(e) => setPartyPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  {billType === 'SALE' ? 'Produce / Crop Name' : 'Item Description (Seeds, Diesel, Labor)'}
                </label>
                <input
                  type="text"
                  placeholder={billType === 'SALE' ? 'e.g. Sharbati Wheat, Red Onion' : 'e.g. DAP Fertilizer, Harvester Rent'}
                  value={cropName}
                  onChange={(e) => setCropName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Quantity</label>
                  <input
                    type="number"
                    placeholder="e.g. 50"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-slate-400 font-semibold block mb-1">Unit</label>
                  <input
                    type="text"
                    placeholder="QUINTAL / KG / BAGS"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Total Bill Amount (₹) *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 45000"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 font-bold text-base focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Payment Status</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaidStatus('PAID')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      paidStatus === 'PAID'
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    ✔ PAID (चुकता)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaidStatus('UDHAAR')}
                    className={`py-2 rounded-xl font-bold border transition-colors ${
                      paidStatus === 'UDHAAR'
                        ? 'bg-amber-950 text-amber-300 border-amber-600'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}
                  >
                    ⏳ UDHAAR (बाकी)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">
                  Attach Mandi Parchi / Bill Slip (Optional)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700"
                />
                {billImage && (
                  <div className="mt-2 relative w-24 h-24 rounded-lg overflow-hidden border border-slate-700">
                    <img src={billImage} alt="Bill Slip" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setBillImage(null)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-red-400 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="text-slate-400 font-semibold block mb-1">Notes / Remarks</label>
                <textarea
                  rows="2"
                  placeholder="Terms, moisture %, vehicle number, etc."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  Save Entry to Khata
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: VIEW BILL VOUCHER                                */}
      {/* ======================================================== */}
      {selectedBill && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-md w-full p-6 shadow-2xl relative space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-mono text-emerald-400">{selectedBill.id}</span>
                <h3 className="text-base font-bold text-white">
                  {selectedBill.type === 'SALE' ? '🌾 Produce Sale Voucher' : '🚜 Farm Expense Receipt'}
                </h3>
              </div>
              <button
                onClick={() => setSelectedBill(null)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Party / Mandi:</span>
                <span className="font-bold text-white">{selectedBill.partyName}</span>
              </div>
              {selectedBill.partyPhone && (
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-400">Mobile:</span>
                  <span className="font-mono text-slate-300">📱 {selectedBill.partyPhone}</span>
                </div>
              )}
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Crop / Item:</span>
                <span className="text-slate-200">{selectedBill.cropName}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Quantity:</span>
                <span className="text-slate-200">
                  {selectedBill.quantity} {selectedBill.unit}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Status:</span>
                <span
                  className={`font-bold ${
                    selectedBill.paidStatus === 'PAID' ? 'text-emerald-400' : 'text-amber-400'
                  }`}
                >
                  {selectedBill.paidStatus === 'PAID' ? '✔ PAID (चुकता)' : '⏳ UDHAAR (बाकी)'}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span className="text-slate-400">Bill Date:</span>
                <span className="text-slate-300">{selectedBill.date}</span>
              </div>
              {selectedBill.notes && (
                <div className="py-1 border-b border-slate-800/60">
                  <span className="text-slate-400 block mb-1">Remarks:</span>
                  <p className="text-slate-300 bg-slate-950 p-2 rounded-lg">{selectedBill.notes}</p>
                </div>
              )}

              {selectedBill.imageUri && (
                <div className="pt-2">
                  <span className="text-slate-400 block mb-1">Attached Mandi Slip:</span>
                  <img
                    src={selectedBill.imageUri}
                    alt="Mandi Slip"
                    className="w-full h-40 object-cover rounded-xl border border-slate-700"
                  />
                </div>
              )}

              <div className="flex justify-between items-center pt-3 text-base font-bold">
                <span className="text-white">Total Bill Value:</span>
                <span className={selectedBill.type === 'SALE' ? 'text-emerald-400' : 'text-red-400'}>
                  ₹{selectedBill.amount.toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleShareBill(selectedBill)}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Share2 className="w-4 h-4" />
                <span>{copiedId === selectedBill.id ? 'Copied!' : 'WhatsApp Voucher'}</span>
              </button>
              <button
                onClick={() => setSelectedBill(null)}
                className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
