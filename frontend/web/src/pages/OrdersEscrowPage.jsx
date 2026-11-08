import React, { useState, useEffect } from 'react';
import { ordersService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ReceiptInvoiceModal from '../components/ReceiptInvoiceModal';
import {
  Lock,
  Truck,
  CheckCircle2,
  Clock,
  Printer,
  Shield,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

// Minimal fallback order for offline dev preview
const DEFAULT_FALLBACK_ORDERS = [
  {
    _id: 'default_ord_001',
    orderNumber: 'CG-ORD-2026-1001',
    cropName: 'Red Onion (Garva Special)',
    farmer: { name: 'Ramesh Patil', phone: '9876543210', district: 'Dharwad' },
    buyer: { name: 'Karnataka State Co-op Federation', phone: '9811223344', district: 'Dharwad' },
    quantity: 120,
    agreedPrice: 2450,
    totalAmount: 294000,
    middlemanFeeSaved: 29400,
    status: 'ESCROW_HELD',
    createdAt: '2026-10-29T10:30:00Z',
  },
];

const STAGES = [
  { key: 'PLACED', label: '1. Placed', icon: Clock },
  { key: 'ESCROW_HELD', label: '2. Escrow Locked', icon: Lock },
  { key: 'DISPATCHED', label: '3. Dispatched', icon: Truck },
  { key: 'DELIVERED', label: '4. Delivered', icon: CheckCircle2 },
  { key: 'SETTLED', label: '5. Settled', icon: Shield },
];

export default function OrdersEscrowPage() {
  const { activePersona, t } = useAuth();
  const o = t.orders || {};
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReceipt, setSelectedReceipt] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const data = await ordersService.getAll();
      if (data && data.orders && data.orders.length > 0) {
        setOrders(data.orders);
      } else {
        setOrders(DEFAULT_FALLBACK_ORDERS);
      }
    } catch (err) {
      console.warn('Orders API error, using fallback:', err.message);
      setOrders(DEFAULT_FALLBACK_ORDERS);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleAdvanceStatus = async (order, nextStatus) => {
    setUpdatingId(order._id);
    try {
      await ordersService.updateStatus(order._id, nextStatus);
      // Update local state
      setOrders((prev) =>
        prev.map((o) => (o._id === order._id ? { ...o, status: nextStatus } : o))
      );
    } catch (err) {
      console.warn('Advance status fallback:', err.message);
      setOrders((prev) =>
        prev.map((o) => (o._id === order._id ? { ...o, status: nextStatus } : o))
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const getNextStatus = (current) => {
    switch (current) {
      case 'PLACED':
        return 'ESCROW_HELD';
      case 'ESCROW_HELD':
        return 'DISPATCHED';
      case 'DISPATCHED':
        return 'DELIVERED';
      case 'DELIVERED':
        return 'SETTLED';
      default:
        return null;
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'PLACED':
        return 'bg-amber-950/70 border-amber-700/60 text-amber-300';
      case 'ESCROW_HELD':
        return 'bg-blue-950/70 border-blue-700/60 text-blue-300';
      case 'DISPATCHED':
        return 'bg-purple-950/70 border-purple-700/60 text-purple-300';
      case 'DELIVERED':
        return 'bg-teal-950/70 border-teal-700/60 text-teal-300';
      case 'SETTLED':
        return 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300';
      default:
        return 'bg-slate-800 text-slate-400';
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-3">
            <Lock className="w-3.5 h-3.5" /> {o.tag || 'Direct Escrow & 5-Stage Settlement State Machine'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {o.title || 'Wholesale Procurement & Escrow Ledger'}
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            {o.subtitle || 'Eliminates payment defaults and delays. Buyer funds remain securely locked in Escrow until verified crop delivery, triggering immediate instant settlement to the farmer.'}
          </p>
        </div>
      </div>

      {/* Pipeline Summary Bar */}
      <div className="glass-panel p-4 rounded-2xl border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <span>{o.activeContracts || 'Active Escrow Contracts'}:</span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-700/50 text-emerald-300">
            {orders.length}
          </span>
        </div>

        <button
          onClick={loadOrders}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" /> {o.refresh || 'Refresh Orders'}
        </button>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {orders.map((order) => {
          const nextStatus = getNextStatus(order.status);
          const currentStageIndex = STAGES.findIndex((s) => s.key === order.status);

          return (
            <div
              key={order._id}
              className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4"
            >
              {/* Order Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-extrabold text-white text-base">
                      {order.orderNumber || order._id}
                    </span>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getStatusBadge(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Commodity: <strong className="text-slate-200">{order.cropName || order.listing?.cropName || 'Produce Lot'}</strong>{' '}
                    • Producer: <span className="text-emerald-400">{order.farmer?.name || order.listing?.farmer?.name || 'Local Farmer'}</span>
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-lg font-black text-emerald-400">
                    ₹{order.totalAmount.toLocaleString('en-IN')}
                  </div>
                  <div className="text-[11px] text-emerald-300 font-medium">
                    +₹{(order.middlemanFeeSaved || order.totalAmount * 0.1).toLocaleString('en-IN')} {o.savedCommission || 'Saved Commission'}
                  </div>
                </div>
              </div>

              {/* 5-Stage Stepper Visualizer */}
              <div className="grid grid-cols-5 gap-2 pt-1">
                {STAGES.map((stage, idx) => {
                  const isCompleted = idx <= currentStageIndex;
                  const isCurrent = idx === currentStageIndex;
                  const Icon = stage.icon;

                  return (
                    <div
                      key={stage.key}
                      className={`p-2 rounded-xl text-center border transition-all ${
                        isCurrent
                          ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-md shadow-emerald-950/50'
                          : isCompleted
                          ? 'bg-slate-900 border-slate-700/80 text-slate-300'
                          : 'bg-slate-950/40 border-slate-800/40 text-slate-600'
                      }`}
                    >
                      <Icon className="w-4 h-4 mx-auto mb-1" />
                      <div className="text-[10px] font-bold truncate">{o.stages?.[stage.key] || stage.label}</div>
                    </div>
                  );
                })}
              </div>

              {/* Order Details & Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 text-xs">
                <div className="flex items-center gap-4 text-slate-400">
                  <span>
                    Volume: <strong className="text-slate-200">{order.quantity} Quintals</strong>
                  </span>
                  <span>
                    Agreed Rate: <strong className="text-slate-200">₹{order.agreedPrice} / qtl</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {/* View Certified Receipt */}
                  <button
                    onClick={() => setSelectedReceipt(order)}
                    className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{o.receiptBtn || 'Certified Receipt'}</span>
                  </button>

                  {/* Advance State Machine Button */}
                  {nextStatus && (
                    <button
                      onClick={() => handleAdvanceStatus(order, nextStatus)}
                      disabled={updatingId === order._id}
                      className="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-1.5 transition-colors shadow-lg shadow-emerald-950/40"
                    >
                      <span>
                        {updatingId === order._id ? 'Updating...' : `${o.advanceBtn || 'Advance to'} ${o.stages?.[nextStatus] || nextStatus}`}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Official UASD APMC Printable Invoice Modal */}
      {selectedReceipt && (
        <ReceiptInvoiceModal
          order={selectedReceipt}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
