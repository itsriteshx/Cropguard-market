import React from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, Activity, Building2, UserCheck, ChevronDown, Sparkles } from 'lucide-react';

export default function Navbar({ onTabChange, activeTab }) {
  const { activePersona, switchPersona, personas, backendOnline } = useAuth();

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand & Academic Badges */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => onTabChange('marketplace')}>
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
                🌾
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-extrabold text-lg text-white tracking-tight">CropGuard</span>
                  <span className="text-xs uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                    Wholesale & Mandi
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Direct Market Access • UASD Dharwad & ICAR Protocol
                </p>
              </div>
            </div>

            {/* Academic Collaboration Pill */}
            <div className="hidden lg:flex items-center gap-2 pl-4 border-l border-slate-800 text-xs text-slate-400">
              <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/60 font-medium text-slate-300">
                🏛️ UASD APMC Cell
              </span>
              <span className="px-2 py-1 rounded bg-slate-800/80 border border-slate-700/60 font-medium text-emerald-300">
                Zero Middleman
              </span>
            </div>
          </div>

          {/* Right Side: Backend Status & Persona Switcher */}
          <div className="flex items-center gap-3">
            {/* Live Gateway Pill */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                backendOnline
                  ? 'bg-emerald-950/70 border-emerald-700/60 text-emerald-300'
                  : 'bg-amber-950/70 border-amber-700/60 text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  backendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
              <span className="hidden sm:inline">
                {backendOnline ? 'Node.js Gateway :5001' : 'Offline / Standalone Demo'}
              </span>
              <span className="sm:hidden">{backendOnline ? 'Live' : 'Demo'}</span>
            </div>

            {/* Persona Switcher Dropdown */}
            <div className="relative group">
              <button className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700 text-left transition-colors">
                <div className="w-7 h-7 rounded-lg bg-emerald-900/60 border border-emerald-600/50 flex items-center justify-center text-xs font-bold text-emerald-300">
                  {activePersona.initials}
                </div>
                <div className="hidden md:block text-left">
                  <div className="text-xs font-bold text-slate-200 line-clamp-1">{activePersona.name}</div>
                  <div className="text-[10px] text-emerald-400 font-medium">{activePersona.badge}</div>
                </div>
                <ChevronDown className="w-4 h-4 text-slate-400" />
              </button>

              {/* Persona Menu */}
              <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 hidden group-hover:block hover:block z-50">
                <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800">
                  Switch Active Role Persona
                </div>
                {personas.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => switchPersona(persona)}
                    className={`w-full text-left p-2.5 rounded-xl mt-1 flex items-start gap-2.5 transition-colors ${
                      activePersona.id === persona.id
                        ? 'bg-emerald-950/60 border border-emerald-800/80 text-emerald-200'
                        : 'hover:bg-slate-800/80 text-slate-300'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 shrink-0">
                      {persona.initials}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-semibold line-clamp-1">{persona.name}</div>
                      <div className="text-[11px] text-slate-400">{persona.badge}</div>
                      <div className="text-[10px] text-slate-500">{persona.district}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* APMC Live Benchmark Ticker */}
      <div className="bg-slate-950 border-t border-slate-800/60 px-4 py-1.5 overflow-x-auto text-[11px] text-slate-400 flex items-center gap-6">
        <span className="font-bold text-emerald-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> UASD Mandi Corridor:
        </span>
        <div className="flex items-center gap-6 shrink-0">
          <span>🧅 Dharwad Onion: <strong className="text-slate-200">₹2,450 / qtl</strong></span>
          <span className="text-slate-600">•</span>
          <span>🌾 Hubballi Wheat: <strong className="text-slate-200">₹2,800 / qtl</strong></span>
          <span className="text-slate-600">•</span>
          <span>🍅 Belagavi Tomato: <strong className="text-slate-200">₹1,950 / qtl</strong></span>
          <span className="text-slate-600">•</span>
          <span>🌽 Haveri Maize: <strong className="text-slate-200">₹2,100 / qtl</strong></span>
          <span className="text-slate-600">•</span>
          <span>⚡ Middleman Margin Eliminated: <strong className="text-emerald-400">+10.0%</strong> Direct Farmer Bonus</span>
        </div>
      </div>
    </header>
  );
}
