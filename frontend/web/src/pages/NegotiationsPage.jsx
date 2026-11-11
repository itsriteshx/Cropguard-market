import React, { useEffect, useMemo, useRef, useState } from 'react';
import { assistantService, negotiationsService, ordersService } from '../services/api';
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
  Mic,
  MicOff,
  Volume2,
  Sparkles,
  IndianRupee,
} from 'lucide-react';

const FARMER_QUICK_CHATS = [
  'Fresh Grade-A harvest ready for dispatch',
  'Pickup available at farm gate today',
  'Transport charges excluded at this rate',
  'Best final rate after cleaning & grading',
];

const BUYER_QUICK_CHATS = [
  'Ready for immediate truck pickup',
  'Payment on dispatch — can we adjust slightly?',
  'Please confirm moisture level & bag weight',
  'Can pick full lot today at this rate',
];

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

  // Price offer state
  const [counterPrice, setCounterPrice] = useState('');
  const [counterNote, setCounterNote] = useState('');
  const [busyAction, setBusyAction] = useState('');

  // Free chat + Voice dictation state
  const [chatText, setChatText] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [dictating, setDictating] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en-IN');

  // Typing & presence & AI tip state
  const [onlineByRoom, setOnlineByRoom] = useState({});
  const [typingByRoom, setTypingByRoom] = useState({});
  const [aiAdvice, setAiAdvice] = useState(null);
  const [loadingAiAdvice, setLoadingAiAdvice] = useState(false);

  const joinedRooms = useRef(new Set());
  const typingTimerRef = useRef(null);
  const recognitionRef = useRef(null);
  const timelineEndRef = useRef(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

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
    return () => {
      try {
        recognitionRef.current?.stop();
        window?.speechSynthesis?.cancel();
      } catch {
        // Ignore cleanup errors
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real-time Socket.io listeners
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

    const handleChatMessage = (data) => {
      if (!data?.negotiationId) return;
      setNegotiations((prev) =>
        prev.map((item) => {
          if (item._id !== data.negotiationId) return item;
          const nextMessages = Array.isArray(data.messages)
            ? data.messages
            : data.message
            ? [...(item.messages || []), data.message]
            : item.messages || [];
          return { ...item, messages: nextMessages };
        })
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

    const handlePresence = (data) => {
      if (!data?.userId) return;
      setOnlineByRoom((prev) => ({ ...prev, [data.userId]: data.status === 'ONLINE' }));
    };

    const handleTyping = (data) => {
      if (!data?.negotiationId) return;
      setTypingByRoom((prev) => ({
        ...prev,
        [data.negotiationId]: Boolean(data.isTyping),
      }));
    };

    setSocketConnected(socket.connected);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('negotiation_created', refresh);
    socket.on('counter_offer_received', handleCounter);
    socket.on('chat_message_received', handleChatMessage);
    socket.on('deal_locked', handleDealLocked);
    socket.on('deal_rejected', handleDealRejected);
    socket.on('participant_status', handlePresence);
    socket.on('participant_typing', handleTyping);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('negotiation_created', refresh);
      socket.off('counter_offer_received', handleCounter);
      socket.off('chat_message_received', handleChatMessage);
      socket.off('deal_locked', handleDealLocked);
      socket.off('deal_rejected', handleDealRejected);
      socket.off('participant_status', handlePresence);
      socket.off('participant_typing', handleTyping);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const canChat = activeNeg && ['OPEN', 'COUNTER_OFFERED', 'ACCEPTED'].includes(activeNeg.status);
  const isMyTurn = isActive && activeNeg.currentTurn === myTurnRole;

  // Merge bidHistory + chat messages into one chronological stream
  const timeline = useMemo(() => {
    if (!activeNeg) return [];
    const bids = (activeNeg.bidHistory || []).map((b, idx) => ({
      kind: 'BID',
      key: `bid-${idx}-${b.timestamp || ''}`,
      role: b.bidderRole,
      pricePerUnit: b.pricePerUnit,
      text: b.note || '',
      timestamp: b.timestamp ? new Date(b.timestamp).getTime() : 0,
      dateObj: b.timestamp,
    }));
    const msgs = (activeNeg.messages || []).map((m, idx) => ({
      kind: 'CHAT',
      key: `msg-${m._id || idx}-${m.timestamp || ''}`,
      role: m.senderRole,
      senderName: m.senderName,
      text: m.text,
      isVoice: Boolean(m.isVoice),
      timestamp: m.timestamp ? new Date(m.timestamp).getTime() : 0,
      dateObj: m.timestamp,
    }));
    return [...bids, ...msgs].sort((a, b) => a.timestamp - b.timestamp);
  }, [activeNeg]);

  useEffect(() => {
    timelineEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [timeline.length, selectedId]);

  useEffect(() => {
    setAiAdvice(null);
  }, [selectedId]);

  const speakMessage = (text) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = voiceLang;
      window.speechSynthesis.speak(u);
    } catch {
      // Ignore synthesis availability issues
    }
  };

  const emitTyping = (isTyping) => {
    if (!token || !activeNeg) return;
    const socket = connectNegotiationSocket(token);
    if (socket?.connected) {
      socket.emit(isTyping ? 'typing_start' : 'typing_stop', {
        negotiationId: activeNeg._id,
      });
    }
  };

  const handleChatInputChange = (val) => {
    setChatText(val);
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 1500);
  };

  const handleSendChatMessage = async (textOverride = null, usedVoice = false) => {
    if (!activeNeg || !canChat || sendingChat) return;
    const finalText = (textOverride ?? chatText).trim();
    if (!finalText) return;

    setSendingChat(true);
    setActionError('');
    emitTyping(false);

    try {
      const res = await negotiationsService.sendMessage(activeNeg._id, {
        text: finalText,
        isVoice: usedVoice,
      });
      if (res?.success && Array.isArray(res.messages)) {
        setNegotiations((prev) =>
          prev.map((item) =>
            item._id === activeNeg._id ? { ...item, messages: res.messages } : item
          )
        );
        if (textOverride === null) setChatText('');
      }
    } catch (err) {
      setActionError(err.response?.data?.message || 'Unable to send chat message.');
    } finally {
      setSendingChat(false);
    }
  };

  const handleToggleChatDictation = () => {
    if (!speechSupported) {
      setActionError('Voice dictation requires Chrome/Safari speech support. Type your message instead.');
      return;
    }

    if (dictating) {
      recognitionRef.current?.stop();
      setDictating(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = voiceLang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const spoken = event.results?.[0]?.[0]?.transcript || '';
      setDictating(false);
      if (spoken.trim()) {
        setChatText((prev) => (prev.trim() ? `${prev.trim()} ${spoken}` : spoken));
      }
    };
    rec.onerror = () => setDictating(false);
    rec.onend = () => setDictating(false);

    recognitionRef.current = rec;
    setDictating(true);
    try {
      rec.start();
    } catch {
      setDictating(false);
    }
  };

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
        // Preserve populated listing, buyer, and farmer objects instead of overwriting with raw IDs
        setNegotiations((prev) =>
          prev.map((item) =>
            item._id === activeNeg._id
              ? {
                  ...item,
                  currentOfferedPrice: res.negotiation.currentOfferedPrice,
                  currentTurn: res.negotiation.currentTurn,
                  status: res.negotiation.status,
                  bidHistory: res.negotiation.bidHistory,
                }
              : item
          )
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

  const handleAskAiAdvisor = async () => {
    if (!activeNeg || loadingAiAdvice) return;
    setLoadingAiAdvice(true);
    try {
      const res = await assistantService.query({
        query: 'Suggest fair counter price for this negotiation',
        lang: voiceLang.startsWith('hi') ? 'hi' : 'en',
        context: {
          cropName: activeNeg.listing?.cropName || '',
          askingPrice: activeNeg.originalListingPrice,
          currentOffer: activeNeg.currentOfferedPrice,
        },
      });
      if (res?.success) {
        setAiAdvice(res);
      }
    } catch {
      setAiAdvice(null);
    } finally {
      setLoadingAiAdvice(false);
    }
  };

  const smartCounterChips = useMemo(() => {
    if (!activeNeg) return [];
    const current = Number(activeNeg.currentOfferedPrice) || 0;
    const ask = Number(activeNeg.originalListingPrice) || current;
    if (!current) return [];

    const chips = [];
    const midpoint = Math.round((current + ask) / 2);
    if (midpoint > 0 && midpoint !== current) {
      chips.push({ label: `Midpoint ₹${midpoint}`, value: midpoint });
    }
    const minus5 = Math.max(1, Math.round(current * 0.95));
    const minus2 = Math.max(1, Math.round(current * 0.98));
    const plus2 = Math.round(current * 1.02);
    const plus5 = Math.round(current * 1.05);

    if (isFarmer) {
      chips.push({ label: `+2%: ₹${plus2}`, value: plus2 });
      chips.push({ label: `+5%: ₹${plus5}`, value: plus5 });
      if (ask > current) chips.push({ label: `Original Ask ₹${ask}`, value: ask });
    } else {
      chips.push({ label: `-5%: ₹${minus5}`, value: minus5 });
      chips.push({ label: `-2%: ₹${minus2}`, value: minus2 });
      chips.push({ label: `+2%: ₹${plus2}`, value: plus2 });
    }
    return chips;
  }, [activeNeg, isFarmer]);

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

  const quickChats = isFarmer ? FARMER_QUICK_CHATS : BUYER_QUICK_CHATS;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Price Negotiations &amp; Live Chat</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time Socket.io bargaining room with free-text chat, voice dictation, quick replies, and AI price tips.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setVoiceLang((prev) => (prev === 'en-IN' ? 'hi-IN' : 'en-IN'))}
            className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-[11px] font-bold text-slate-300 hover:text-white"
            title="Switch Voice Input/Read Language"
          >
            Voice: {voiceLang === 'hi-IN' ? 'HI' : 'EN'}
          </button>
          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border ${
              socketConnected
                ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
                : 'bg-slate-900 border-slate-700 text-slate-400'
            }`}
          >
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
          {/* Left Room List */}
          <div className="space-y-2.5">
            {negotiations.map((neg) => {
              const counterpart = isFarmer ? neg.buyer : neg.farmer;
              const counterpartOnline = Boolean(onlineByRoom[counterpart?._id]);
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
                    <span className="flex items-center gap-1.5 truncate">
                      {counterpartOnline && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />}
                      {counterpart?.name || (isFarmer ? 'Buyer' : 'Farmer')}
                    </span>
                    <strong className="text-emerald-400">
                      ₹{Number(neg.agreedPrice || neg.currentOfferedPrice).toLocaleString('en-IN')}/{neg.listing?.unit || 'unit'}
                    </strong>
                  </div>
                  {waitingOnMe && (
                    <div className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Your turn to counter or accept
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right Conversation & Controls Panel */}
          {activeNeg && (
            <div className="lg:col-span-2 rounded-2xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between space-y-4">
              {/* Room Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-bold text-white">
                      {activeNeg.listing?.cropName || 'Produce Lot'}
                    </h2>
                    {onlineByRoom[(isFarmer ? activeNeg.buyer?._id : activeNeg.farmer?._id)] && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-[10px] font-bold text-emerald-300">
                        Online in room
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Qty: {activeNeg.quantity} {activeNeg.listing?.unit || 'Quintal'} • Original Ask: ₹
                    {Number(activeNeg.originalListingPrice).toLocaleString('en-IN')} • Counterpart:{' '}
                    <span className="text-slate-200 font-semibold">
                      {(isFarmer ? activeNeg.buyer?.name : activeNeg.farmer?.name) || (isFarmer ? 'Buyer' : 'Farmer')}
                    </span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {isActive && (
                    <button
                      type="button"
                      onClick={handleAskAiAdvisor}
                      disabled={loadingAiAdvice}
                      className="px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-700/70 text-[11px] font-bold text-emerald-300 flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{loadingAiAdvice ? 'Thinking...' : 'AI Price Tip'}</span>
                    </button>
                  )}
                  <div className="text-left sm:text-right">
                    <div className="text-[10px] uppercase text-slate-400 font-bold">Current Offer</div>
                    <div className="text-xl font-black text-emerald-400">
                      ₹{Number(activeNeg.agreedPrice || activeNeg.currentOfferedPrice).toLocaleString('en-IN')}
                      <span className="text-xs text-slate-400 font-normal"> / {activeNeg.listing?.unit || 'unit'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Advisor Card (when requested) */}
              {aiAdvice && (
                <div className="p-3 rounded-xl bg-gradient-to-r from-emerald-950/70 to-slate-950 border border-emerald-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-1">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> CropGuard Price Assistant
                    </div>
                    <p className="text-slate-200">{aiAdvice.reply}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => speakMessage(aiAdvice.reply)}
                      className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300"
                      title="Listen to advice"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    {aiAdvice.suggestedPrice && isMyTurn && (
                      <button
                        type="button"
                        onClick={() => setCounterPrice(String(aiAdvice.suggestedPrice))}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]"
                      >
                        Use ₹{aiAdvice.suggestedPrice}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Chronological Bid + Chat Message Thread */}
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {timeline.map((entry) => {
                  const mine = entry.role === myTurnRole;
                  if (entry.kind === 'BID') {
                    return (
                      <div
                        key={entry.key}
                        className={`p-3 rounded-2xl border text-xs max-w-md ${
                          mine
                            ? 'ml-auto bg-emerald-950/60 border-emerald-700/70 text-emerald-100 rounded-br-sm'
                            : 'mr-auto bg-slate-950 border-slate-700 text-slate-200 rounded-bl-sm'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className="font-bold text-[10px] uppercase tracking-wider text-amber-300 flex items-center gap-1">
                            <IndianRupee className="w-3 h-3" /> {entry.role} OFFER
                          </span>
                          <span className="font-black text-emerald-400 text-sm">
                            ₹{Number(entry.pricePerUnit).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {entry.text && <p className="text-slate-200">{entry.text}</p>}
                        <div className="flex items-center justify-between gap-3 mt-1.5 text-[10px] text-slate-400">
                          <span>{entry.dateObj ? new Date(entry.dateObj).toLocaleString('en-IN') : ''}</span>
                          <button
                            type="button"
                            onClick={() =>
                              speakMessage(
                                `${entry.role} offered ${entry.pricePerUnit} rupees. ${entry.text || ''}`
                              )
                            }
                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300"
                          >
                            <Volume2 className="w-3 h-3" /> Listen
                          </button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={entry.key}
                      className={`px-3.5 py-2.5 rounded-2xl border text-xs max-w-md ${
                        mine
                          ? 'ml-auto bg-sky-950/60 border-sky-700/60 text-sky-50 rounded-br-sm'
                          : 'mr-auto bg-slate-950 border-slate-800 text-slate-200 rounded-bl-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-0.5 text-[10px] text-slate-400">
                        <span className="font-bold uppercase">
                          {entry.senderName || entry.role} {entry.isVoice ? '🎙️ Voice' : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => speakMessage(entry.text)}
                          className="text-sky-300 hover:text-white inline-flex items-center gap-0.5"
                          title="Read message aloud"
                        >
                          <Volume2 className="w-3 h-3" />
                        </button>
                      </div>
                      <p className="text-slate-100 leading-relaxed">{entry.text}</p>
                      <div className="text-[10px] text-slate-500 mt-1">
                        {entry.dateObj ? new Date(entry.dateObj).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  );
                })}

                {typingByRoom[activeNeg._id] && (
                  <div className="text-[11px] italic text-emerald-400 px-1">
                    Counterpart is typing...
                  </div>
                )}
                <div ref={timelineEndRef} />
              </div>

              {actionError && (
                <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-300 text-xs">
                  {actionError}
                </div>
              )}

              {/* Always-Available Direct Chat & Voice Dictation Bar (Open or Accepted deals) */}
              {canChat && (
                <div className="pt-2 border-t border-slate-800 space-y-2.5">
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <span className="text-[10px] font-bold text-slate-400 shrink-0">Quick Chat:</span>
                    {quickChats.map((msg) => (
                      <button
                        key={msg}
                        type="button"
                        onClick={() => handleSendChatMessage(msg, false)}
                        disabled={sendingChat}
                        className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 hover:border-sky-500 text-[11px] text-slate-300 shrink-0 transition-colors"
                      >
                        {msg}
                      </button>
                    ))}
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSendChatMessage(null, false);
                    }}
                    className="flex items-center gap-2"
                  >
                    <button
                      type="button"
                      onClick={handleToggleChatDictation}
                      className={`p-2.5 rounded-xl border shrink-0 transition-all ${
                        dictating
                          ? 'bg-red-600 border-red-500 text-white animate-pulse'
                          : 'bg-slate-950 border-slate-700 hover:border-emerald-500 text-emerald-400'
                      }`}
                      title={dictating ? 'Stop voice dictation' : 'Speak message'}
                    >
                      {dictating ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                    </button>
                    <input
                      type="text"
                      maxLength={500}
                      value={chatText}
                      onChange={(e) => handleChatInputChange(e.target.value)}
                      placeholder={
                        dictating
                          ? 'Listening... speak your message'
                          : 'Message about delivery, bags, moisture, or pickup...'
                      }
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-700 focus:border-sky-500 text-xs text-white outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!chatText.trim() || sendingChat}
                      className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 shrink-0"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Chat</span>
                    </button>
                  </form>
                </div>
              )}

              {/* Price Negotiation Controls */}
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
                    {smartCounterChips.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] font-bold text-slate-400">Counter Presets:</span>
                        {smartCounterChips.map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => setCounterPrice(String(chip.value))}
                            className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 hover:border-emerald-500 text-[11px] font-semibold text-emerald-300"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    )}

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
                        placeholder="Price note (optional)"
                        value={counterNote}
                        onChange={(e) => setCounterNote(e.target.value)}
                        className="flex-1 px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={!!busyAction}
                        className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 border border-slate-700"
                      >
                        <IndianRupee className="w-3.5 h-3.5" />
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
                    <span>Price turn is with counterpart — you can still send chat messages above anytime.</span>
                    <button
                      onClick={handleReject}
                      disabled={!!busyAction}
                      className="text-red-400 hover:text-red-300 font-semibold shrink-0 ml-2"
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
