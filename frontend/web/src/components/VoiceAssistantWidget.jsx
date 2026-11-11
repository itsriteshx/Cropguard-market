import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Send,
  X,
  Sparkles,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { assistantService } from '../services/api';

const QUICK_PROMPTS = {
  en: [
    'What is Onion price?',
    'Check Dharwad weather',
    'Open Sell Produce',
    'Go to APMC Mandi',
  ],
  hi: [
    'Onion ka rate kya hai?',
    'Pune ka mausam batao',
    'Open Sell Produce',
    'Open Negotiations',
  ],
};

export default function VoiceAssistantWidget({ activeTab, onNavigateTab }) {
  const [open, setOpen] = useState(false);
  const [voiceLang, setVoiceLang] = useState('en');
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [listening, setListening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inputText, setInputText] = useState('');
  const [history, setHistory] = useState([
    {
      role: 'assistant',
      text: 'Hi! Tap the Mic or type a question: "Onion ka rate kya hai?", "Check Pune weather", or "Open Sell Produce".',
    },
  ]);

  const recognitionRef = useRef(null);
  const endRef = useRef(null);

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (open && endRef.current) {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history, open]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.stop();
        window?.speechSynthesis?.cancel();
      } catch {
        // Ignore cleanup errors
      }
    };
  }, []);

  const speakText = (text, langOverride = voiceLang) => {
    if (typeof window === 'undefined' || !window.speechSynthesis || !text) return;
    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = langOverride === 'hi' ? 'hi-IN' : 'en-IN';
      utter.rate = 1.0;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore synthesis availability issues
    }
  };

  const runAssistantQuery = async (rawQuery) => {
    const clean = String(rawQuery || '').trim();
    if (!clean || busy) return;

    setHistory((prev) => [...prev, { role: 'user', text: clean }]);
    setInputText('');
    setBusy(true);

    try {
      const res = await assistantService.query({
        query: clean,
        lang: voiceLang,
        context: { activeTab },
      });

      const replyText = res?.reply || 'Done.';
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: replyText,
          rates: res?.rates || [],
          weather: res?.weather || null,
          action: res?.action || null,
        },
      ]);

      if (autoSpeak) {
        speakText(replyText, voiceLang);
      }

      // Immediate navigation only when user explicitly gave a navigate voice intent
      if (res?.intent === 'NAVIGATE' && res?.action?.navigateTo && onNavigateTab) {
        onNavigateTab(res.action.navigateTo);
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message || 'Unable to reach assistant service right now.';
      setHistory((prev) => [...prev, { role: 'assistant', text: errMsg }]);
    } finally {
      setBusy(false);
    }
  };

  const toggleListening = () => {
    if (!speechSupported) {
      setHistory((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Browser microphone speech recognition is unavailable here — type your question below or tap a quick prompt.',
        },
      ]);
      return;
    }

    if (listening) {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
      setListening(false);
      return;
    }

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SpeechRec();
    rec.lang = voiceLang === 'hi' ? 'hi-IN' : 'en-IN';
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      setListening(false);
      if (transcript.trim()) {
        runAssistantQuery(transcript);
      }
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    setListening(true);
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open ? (
        <div className="w-[350px] sm:w-[390px] rounded-2xl bg-slate-900 border border-emerald-700/60 shadow-2xl overflow-hidden flex flex-col max-h-[540px]">
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-emerald-950 to-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 flex items-center justify-center text-white shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-white truncate flex items-center gap-1">
                  CropGuard AI Voice Assistant <Sparkles className="w-3 h-3 text-emerald-400" />
                </div>
                <div className="text-[10px] text-emerald-300">
                  {listening ? 'Listening... speak now' : 'Mandi Prices • Weather • Voice Control'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setVoiceLang((prev) => (prev === 'en' ? 'hi' : 'en'))}
                className="px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-[10px] font-bold text-slate-200"
                title="Switch voice language"
              >
                {voiceLang === 'hi' ? 'HI' : 'EN'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = !autoSpeak;
                  setAutoSpeak(next);
                  if (!next) window?.speechSynthesis?.cancel();
                }}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
                title={autoSpeak ? 'Mute voice reply' : 'Enable voice reply'}
              >
                {autoSpeak ? <Volume2 className="w-3.5 h-3.5 text-emerald-400" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
                aria-label="Close voice assistant"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Conversation Stream */}
          <div className="flex-1 p-3.5 space-y-3 overflow-y-auto bg-slate-950/70">
            {history.map((msg, idx) => (
              <div
                key={idx}
                className={`flex flex-col gap-1.5 ${
                  msg.role === 'user' ? 'items-end' : 'items-start'
                }`}
              >
                <div
                  className={`max-w-[88%] px-3 py-2 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-emerald-600 text-white rounded-br-sm'
                      : 'bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-sm'
                  }`}
                >
                  <div>{msg.text}</div>

                  {msg.role === 'assistant' && (
                    <button
                      type="button"
                      onClick={() => speakText(msg.text)}
                      className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-semibold"
                    >
                      <Volume2 className="w-3 h-3" /> Read aloud
                    </button>
                  )}
                </div>

                {Array.isArray(msg.rates) && msg.rates.length > 0 && (
                  <div className="w-[88%] space-y-1">
                    {msg.rates.map((r, rIdx) => (
                      <div
                        key={rIdx}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] flex items-center justify-between gap-2"
                      >
                        <span className="text-slate-300 truncate">
                          {r.commodity} • {r.marketCenter}
                        </span>
                        <strong className="text-emerald-400 font-mono shrink-0">
                          ₹{Number(r.modalPrice).toLocaleString('en-IN')}/qtl
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                {msg.action?.navigateTo && onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab(msg.action.navigateTo)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold"
                  >
                    <span>{msg.action.label || 'Open Screen'}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {busy && (
              <div className="text-[11px] text-emerald-400">Checking live CropGuard data...</div>
            )}
            <div ref={endRef} />
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-2 bg-slate-900/95 border-t border-slate-800 flex items-center gap-1.5 overflow-x-auto">
            {QUICK_PROMPTS[voiceLang].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => runAssistantQuery(q)}
                className="px-2.5 py-1 rounded-full bg-slate-950 border border-slate-800 hover:border-emerald-500 text-[10px] text-slate-300 shrink-0"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Voice + Text Controls */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              runAssistantQuery(inputText);
            }}
            className="p-3 bg-slate-900 border-t border-slate-800 flex items-center gap-2"
          >
            <button
              type="button"
              onClick={toggleListening}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                listening
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
              title={listening ? 'Stop voice input' : 'Speak question'}
            >
              {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={voiceLang === 'hi' ? 'Boliye ya likhiye...' : 'Speak or type command...'}
              className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 focus:border-emerald-500 text-xs text-white outline-none"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || busy}
              className="w-9 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-emerald-400 flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-extrabold text-xs shadow-2xl shadow-emerald-950 border border-emerald-300/30 transition-transform hover:scale-105"
        >
          <Mic className="w-4 h-4" />
          <span>AI Voice Assistant</span>
        </button>
      )}
    </div>
  );
}
