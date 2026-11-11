import React, { useState, useEffect, useRef } from 'react';
import { negotiationsService, ordersService } from '../services/api';
import { connectNegotiationSocket } from '../services/socket';
import { useAuth } from '../context/AuthContext';
import {
  MessageSquare,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  ShoppingBag,
  Clock,
  Wifi,
} from 'lucide-react';

export default function NegotiationsPage({ onNavigateToOrders }) {
  const { currentUser, token } = useAuth();
  const isFarmer = currentUser?.role === 'FARMER';
  const myTurnRole = isFarmer ? 'FARMER' : 'BUYER';

  const [negotiations, setNegotiations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [socketConnected, setSocketConnected] = useState(false);

  const [counterPrice, setCounterPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const joinedRooms = useRef(new Set());

  const loadNegotiations = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await negotiationsService.getMy();
      if (res?.success && Array.isArray(res.negotiations)) {
        setNegotiations(res.negotiations);
        if (!selectedId && res.negotiations.length > 0) {
          setSelectedId(res.negotiations[0]._id);
        }
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to load negotiations.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNegotiations();
  }, []);

  // Real-time Socket.io listener
  useEffect(() => {
    if (!token) return;
    const socket = connectNegotiationSocket(token);
    if (!socket) return;

    const handleConnect = () => setSocketConnected(true);
    const handleDisconnect = () => setSocketConnected(false);

    const refresh = () => loadNegotiations();

    const handleCounter = (data) => {
      if (!data?.negotiationId) return;
      setNegotiations((prev) =>
        prev.map((item) =>
          item._id === data.negotiationId
            ? {
                ...item,
                currentOfferedPrice: data.currentOfferedPrice,
                currentTurn: data.currentTurn,
                status: data.status || 'COUNTER_OFFERED',
                bidHistory: data.bidHistory || item.bidHistory,
              }
            : item
        )
      );
    };

    const handleDealLocked = (data) => {
      const id = data?.dealSummary?.negotiationId;
      if (!id) return refresh();
      setNegotiations((prev) =>
        prev.map((item) =>
          item._id === id
            ? {
                ...item,
                status: 'ACCEPTED',
                agreedPrice: data.dealSummary.agreedPricePerUnit,
                agreedTotalAmount: data.dealSummary.agreedTotalAmount,
              }
            : item
        )
      );
    };

    const handleDealRejected = (data) => {
      if (!data?.negotiationId) return;
      setNegotiations((prev) =>
        prev.map((item) =>
          item._id === data.negotiationId ? { ...item, status: 'REJECTED' } : item
        )
      );
    };

    setSocketConnected(socket.connected);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('negotiation_created', refresh);
    socket.on('counter_offer_received', handleCounter);
    socket.on('deal_locked', handleDealLocked);
    socket.on('deal_rejected', handleDealRejected);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('negotiation_created', refresh);
      socket.off('counter_offer_received', handleCounter);
      socket.off('deal_locked', handleDealLocked);
      socket.off('deal_rejected', handleDealRejected);
    };
  }, [token]);

  // Join rooms for active negotiations
  useEffect(() => {
    if (!token || !socketConnected) return;
    const socket = connectNegotiationSocket(token);
    if (!socket) return;
    negotiations.forEach((n) => {
      if (!joinedRooms.current.has(n._id)) {
        socket.emit('join_room', { negotiationId: n._id });
        joinedRooms.current.add(n._id);
      }
    });
  }, [negotiations, socketConnected, token]);

  const activeNeg = negotiations.find((n) => n._id === selectedId) || null;
  const isActive = activeNeg && ['OPEN', 'COUNTER_OFFERED'].includes(activeNeg.status);
  const isMyTurn = isActive && activeNeg.currentTurn === myTurnRole;

  const handleCounterOffer = async (e) => {
    e.preventDefault();
    if (!activeNeg) return;
    const val = Number(counterPrice);
    if (!Number.isFinite(val) || val < 1) {
      setActionError('Enter a valid counter price.');
      return;
    }
    setBusyAction('counter');
    setActionError('');
    try {
      const res = await negotiationsService.counter(activeNeg._id, {
        counterPrice: val,
        note: counterNote.trim() || undefined,
      });
      if (res?.success && res.negotiation) {
        setNegotiations((prev) =>
          prev.map((item) => (item._id === activeNeg._id ? { ...item, ...res.negotiation } : item))
        );
        setCounterPrice('');
        setCounterNote('');
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Could not send counter offer.');
    } finally {
      setBusyAction('');
    }
  };

  const handleAccept = async () => {
    if (!activeNeg) return;
    setBusyAction('accept');
    setActionError('');
    try {
      const res = await negotiationsService.accept(activeNeg._id, activeNeg.currentOfferedPrice);
      if (res?.success) {
        await loadNegotiations();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Unable to accept deal.');
    } finally {
      setBusyAction('');
    }
  };

  const handleReject = async () => {
    if (!activeNeg) return;
    setBusyAction('reject');
    setActionError('');
    try {
      const res = await negotiationsService.reject(activeNeg._id, 'Closed by participant');
      if (res?.success) {
        await loadNegotiations();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Unable to close negotiation.');
    } finally {
      setBusyAction('');
    }
  };

  const handleCreateOrderFromDeal = async () => {
    if (!activeNeg) return;
    setBusyAction('order');
    setActionError('');
    try {
      const res = await ordersService.create({ negotiationId: activeNeg._id });
      if (res?.success) {
        await loadNegotiations();
        if (onNavigateToOrders) onNavigateToOrders();
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Unable to convert deal into order.');
    } finally {
      setBusyAction('');
    }
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-emerald-950 text-emerald-300 border-emerald-700';
      case 'REJECTED':
      case 'EXPIRED':
        return 'bg-red-950 text-red-300 border-red-800';
      default:
        return 'bg-amber-950 text-amber-300 border-amber-700';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Price Negotiations</h1>
          <p className="text-xs text-slate-400 mt-1">
            Live direct offer & counter-offer room powered by Socket.io. Zero broker interference.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
            socketConnected
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-slate-900 border-slate-700 text-slate-400'
          }`}>
            <Wifi className="w-3.5 h-3.5" />
            {socketConnected ? 'Live Socket Connected' : 'Connecting...'}
          </span>
          <button
            onClick={loadNegotiations}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300"
            title="Refresh negotiations"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs">{error}</div>
      )}

      {loading ? (
        <div className="py-16 text-center text-sm text-slate-400">Loading your negotiations...</div>
      ) : negotiations.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
          <MessageSquare className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm font-semibold text-white">No negotiations yet</p>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {isFarmer
              ? 'When buyers send price offers on your listed crops, they appear here in real time.'
              : 'Open Marketplace and click "Make Offer" on any crop lot to start negotiating with the farmer.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left List */}
          <div className="space-y-2.5">
            {negotiations.map((neg) => {
              const counterpart = isFarmer ? neg.buyer : neg.farmer;
              const selected = neg._id === activeNeg?._id;
              const waitingOnMe =
                ['OPEN', 'COUNTER_OFFERED'].includes(neg.status) && neg.currentTurn === myTurnRole;

              return (
                <button
                  key={neg._id}
                  onClick={() => {
                    setSelectedId(neg._id);
                    setActionError('');
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition-all space-y-2 ${
                    selected
                      ? 'bg-slate-800/90 border-emerald-500/70'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-bold text-sm text-white truncate">
                      {neg.listing?.cropName || 'Produce Lot'}
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${getStatusStyle(neg.status)}`}>
                      {neg.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{counterpart?.name || 'Participant'}</span>
                    <strong className="text-emerald-400">
                      ₹{Number(neg.agreedPrice || neg.currentOfferedPrice).toLocaleString('en-IN')}/{neg.listing?.unit || 'unit'}
                    </strong>
                  </div>
                  {waitingOnMe && (
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Your turn to respond
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Conversation / Action Panel */}
          {activeNeg && (
            <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between space-y-4">
              {/* Room Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{activeNeg.listing?.cropName || 'Produce Lot'}</h2>
                  <p className="text-xs text-slate-400">
                    Qty: {activeNeg.quantity} {activeNeg.listing?.unit || 'Quintal'} • Original Ask: ₹
                    {Number(activeNeg.originalListingPrice).toLocaleString('en-IN')} • Counterpart:{' '}
                    <span className="text-slate-200 font-semibold">
                      {(isFarmer ? activeNeg.buyer?.name : activeNeg.farmer?.name) || 'Participant'}
                    </span>
                  </p>
                </div>
                <div className="text-left sm:text-right">
                  <div className="text-[10px] uppercase text-slate-400 font-bold">Current Offer</div>
                  <div className="text-xl font-black text-emerald-400">
                    ₹{Number(activeNeg.agreedPrice || activeNeg.currentOfferedPrice).toLocaleString('en-IN')}
                    <span className="text-xs text-slate-400 font-normal"> / {activeNeg.listing?.unit || 'unit'}</span>
                  </div>
                </div>
              </div>

              {/* Bid History */}
              <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {(activeNeg.bidHistory || []).map((bid, idx) => {
                  const mine = bid.bidderRole === myTurnRole;
                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs max-w-md ${
                        mine
                          ? 'ml-auto bg-emerald-950/60 border-emerald-800/70 text-emerald-100'
                          : 'mr-auto bg-slate-950 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1">
                        <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">
                          {bid.bidderRole}
                        </span>
                        <span className="font-black text-emerald-400 text-sm">
                          ₹{Number(bid.pricePerUnit).toLocaleString('en-IN')}
                        </span>
                      </div>
                      {bid.note && <p className="text-slate-300">{bid.note}</p>}
                      <div className="text-[10px] text-slate-500 mt-1">
                        {bid.timestamp ? new Date(bid.timestamp).toLocaleString('en-IN') : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
                  {actionError}
                </div>
              )}

              {/* Controls */}
              {activeNeg.status === 'ACCEPTED' ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Deal Accepted at ₹{Number(activeNeg.agreedPrice || activeNeg.currentOfferedPrice).toLocaleString('en-IN')}/{activeNeg.listing?.unit || 'unit'}
                    </div>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Total value: ₹{Number(activeNeg.agreedTotalAmount || activeNeg.currentOfferedPrice * activeNeg.quantity).toLocaleString('en-IN')}
                    </p>
                  </div>
                  {!isFarmer && !activeNeg.order ? (
                    <button
                      onClick={handleCreateOrderFromDeal}
                      disabled={busyAction === 'order'}
                      className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>{busyAction === 'order' ? 'Creating Order...' : 'Convert to Order'}</span>
                    </button>
                  ) : activeNeg.order && onNavigateToOrders ? (
                    <button
                      onClick={onNavigateToOrders}
                      className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 text-xs font-bold"
                    >
                      View Created Order →
                    </button>
                  ) : null}
                </div>
              ) : isActive ? (
                isMyTurn ? (
                  <div className="space-y-3 pt-2 border-t border-slate-800">
                    <form onSubmit={handleCounterOffer} className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="number"
                        min={1}
                        placeholder="Your counter ₹/unit"
                        value={counterPrice}
                        onChange={(e) => setCounterPrice(e.target.value)}
                        className="sm:w-44 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
                      <input
                        type="text"
                        placeholder="Optional note (e.g. Grade A delivery included)"
                        value={counterNote}
                        onChange={(e) => setCounterNote(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={!!busyAction}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Counter</span>
                      </button>
                    </form>

                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={handleAccept}
                        disabled={!!busyAction}
                        className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Accept Offer (₹{Number(activeNeg.currentOfferedPrice).toLocaleString('en-IN')})</span>
                      </button>
                      <button
                        onClick={handleReject}
                        disabled={!!busyAction}
                        className="px-4 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900/60 text-red-300 border border-red-800 text-xs font-bold flex items-center gap-1.5"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Decline</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span>Waiting for the other participant to counter or accept your offer.</span>
                    <button
                      onClick={handleReject}
                      disabled={!!busyAction}
                      className="text-red-400 hover:text-red-300 font-semibold"
                    >
                      Close Offer
                    </button>
                  </div>
                )
              ) : (
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-400">
                  This negotiation is closed ({activeNeg.status}).
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
