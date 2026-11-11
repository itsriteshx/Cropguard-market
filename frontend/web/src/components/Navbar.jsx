import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { mandiService } from '../services/api';
import { ShieldCheck, Activity, Building2, UserCheck, ChevronDown, Sparkles, Globe, Check, LogIn, LogOut, User } from 'lucide-react';
import AuthModal from './AuthModal';

export default function Navbar({ onTabChange, activeTab }) {
  const {
    backendOnline,
    language,
    setLanguage,
    languages,
    t,
    currentUser,
    logout,
    authModalOpen,
    setAuthModalOpen
  } = useAuth();
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [tickerRates, setTickerRates] = useState([]);

  useEffect(() => {
    let active = true;
    mandiService
      .getRates({ state: 'ALL', limit: 15 })
      .then((res) => {
        if (active && res?.success && Array.isArray(res.rates)) {
          setTickerRates(res.rates.slice(0, 15));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const activeLang = languages.find((l) => l.code === language) || languages[0];
  const n = t.navbar || {};

  return (
    <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Clean Brand Header */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => onTabChange('marketplace')}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center text-lg shadow-lg shadow-emerald-500/20">
              🌾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">CropGuard Market</span>
                <span className="hidden sm:inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/80">
                  Direct Mandi
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Farmer-to-Buyer Agricultural Exchange
              </p>
            </div>
          </div>

          {/* Right Side: Language Selector, Backend Status & Persona Switcher */}
          <div className="flex items-center gap-2.5">
            {/* 8-Language Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-emerald-600/40 text-xs font-bold text-emerald-300 transition-colors shadow-sm"
                title="Select Platform Language"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-sm">{activeLang.flag}</span>
                <span className="hidden sm:inline">{activeLang.nativeName}</span>
                <span className="text-[10px] uppercase font-mono px-1 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  {activeLang.code}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {langMenuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setLangMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-400 border-b border-slate-800 flex items-center justify-between">
                      <span>{n.languagesTitle || 'Supported Languages (8)'}</span>
                      <span className="text-emerald-400 font-mono text-[9px]">UASD / ICAR</span>
                    </div>

                    <div className="max-h-80 overflow-y-auto py-1 space-y-1">
                      {languages.map((lang) => {
                        const isSelected = lang.code === language;
                        return (
                          <button
                            key={lang.code}
                            onClick={() => {
                              setLanguage(lang.code);
                              setLangMenuOpen(false);
                            }}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-emerald-950/80 border border-emerald-700/80 text-emerald-200'
                                : 'hover:bg-slate-800/80 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{lang.flag}</span>
                              <div>
                                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <span>{lang.nativeName}</span>
                                  <span className="text-[11px] text-slate-400 font-normal">({lang.name})</span>
                                </div>
                                <div className="text-[10px] text-slate-400 line-clamp-1">{lang.region}</div>
                              </div>
                            </div>

                            {isSelected && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Live Gateway Pill */}
            <div
              className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
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
              <span className="hidden md:inline">
                {backendOnline ? 'Node.js Gateway :5001' : 'API Offline'}
              </span>
              <span className="md:hidden">{backendOnline ? 'Live' : 'Offline'}</span>
            </div>

            {/* User Profile Badge or Sign In Trigger */}
            {currentUser ? (
              <div className="relative group">
                <button className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/60 text-left transition-colors shadow-sm">
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-xs font-bold text-white shadow">
                    {(currentUser.name || 'U')[0].toUpperCase()}
                  </div>
                  <div className="hidden md:block text-left">
                    <div className="text-xs font-bold text-white line-clamp-1">{currentUser.name}</div>
                    <div className="text-[10px] text-emerald-400 font-semibold">{currentUser.role}</div>
                  </div>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {/* User Dropdown */}
                <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl p-2 hidden group-hover:block hover:block z-50">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="text-xs font-bold text-white">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-400">{currentUser.phone}</div>
                    <div className="inline-block mt-1 px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 text-[10px] font-bold border border-emerald-800">
                      {currentUser.role} • Verified
                    </div>
                  </div>
                  <button
                    onClick={logout}
                    className="w-full text-left p-2.5 rounded-xl mt-1 flex items-center gap-2 hover:bg-red-950/50 text-red-400 text-xs font-bold transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAuthModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-xs font-bold text-white shadow-md shadow-emerald-950 transition-all"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />

      {/* APMC Live Benchmark Ticker (sourced from live backend / data.gov.in Agmarknet API) */}
      <div className="bg-slate-950 border-t border-slate-800/60 px-4 py-1.5 overflow-x-auto text-[11px] text-slate-400 flex items-center gap-6">
        <span className="font-bold text-emerald-400 shrink-0 flex items-center gap-1">
          <Sparkles className="w-3.5 h-3.5" /> {n.tickerTitle || 'Live Agmarknet Feed:'}
        </span>
        <div className="flex items-center gap-5 shrink-0">
          {tickerRates.length > 0 ? (
            tickerRates.map((rate, idx) => (
              <React.Fragment key={rate._id || idx}>
                {idx > 0 && <span className="text-slate-600">•</span>}
                <button
                  type="button"
                  onClick={() => onTabChange?.('mandi')}
                  className="hover:text-emerald-300 transition-colors text-left"
                  title={`${rate.marketCenter || rate.district} (${rate.state || 'India'}) — Click to view full Agmarknet data`}
                >
                  {rate.marketCenter || rate.district} {rate.commodity}
                  {rate.variety ? ` (${rate.variety})` : ''}:{' '}
                  <strong className="text-slate-200">
                    ₹{Number(rate.modalPrice).toLocaleString('en-IN')} / qtl
                  </strong>
                </button>
              </React.Fragment>
            ))
          ) : (
            <span className="text-slate-500">Syncing live Agmarknet mandi rates...</span>
          )}
        </div>
      </div>
    </header>
  );
}
