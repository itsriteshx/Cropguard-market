import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Lock, Phone, User, ShieldCheck, Sparkles, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export default function AuthModal({ isOpen, onClose }) {
  const { login, register, loading } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('FARMER');
  const [district, setDistrict] = useState('Dharwad');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      setError('Please provide a valid 10-digit Indian mobile number.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setError('Please enter your full name.');
        return;
      }

      const res = await register({
        name: name.trim(),
        phone: phone.trim(),
        password,
        role,
        location: {
          village: 'Mandi Corridor',
          district: district.trim() || 'Dharwad',
          state: 'Karnataka',
        },
      });

      if (res.success) {
        setSuccessMsg(`Welcome, ${res.user?.name}! Your verified ${role} account is active.`);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setError(res.message || 'Registration failed. Please try again.');
      }
    } else {
      const res = await login(phone.trim(), password);
      if (res.success) {
        setSuccessMsg(`Signed in as ${res.user?.name || 'User'}!`);
        setTimeout(() => {
          onClose();
        }, 1000);
      } else {
        setError(res.message || 'Invalid credentials. Please verify your phone and password.');
      }
    }
  };

  const handleFillDemo = (demoPhone, demoPass) => {
    setMode('login');
    setPhone(demoPhone);
    setPassword(demoPass);
    setError('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative w-full max-w-md rounded-3xl bg-slate-900 border border-slate-800 shadow-2xl p-6 sm:p-8 overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -left-24 w-60 h-60 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-60 h-60 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Branding */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-800/80 text-emerald-400 text-[10px] font-bold tracking-wider uppercase mb-2">
            <Sparkles className="w-3 h-3" />
            <span>UASD Dharwad Escrow Portal</span>
          </div>
          <h2 className="text-2xl font-black text-white tracking-tight">
            {mode === 'login' ? 'Sign in to CropGuard' : 'Create Verified Account'}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            {mode === 'login'
              ? 'Access wholesale agricultural corridors & live APMC escrow.'
              : 'Direct market trade registration with 0% broker commission.'}
          </p>
        </div>

        {/* Toggle Mode Tabs */}
        <div className="flex p-1 mb-5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              mode === 'login'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError('');
            }}
            className={`flex-1 py-2 rounded-lg transition-all ${
              mode === 'register'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register Account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Full Name / FPO Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Patil"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-white text-xs outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Mobile Number</label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                maxLength={10}
                placeholder="10-digit mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-white text-xs font-mono outline-none transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                required
                placeholder="Minimum 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl text-white text-xs outline-none transition-colors"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Platform Role</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'FARMER', label: 'Farmer / FPO', icon: '🌾' },
                  { id: 'BUYER_RETAIL', label: 'Retail Buyer', icon: '🛒' },
                  { id: 'BUYER_WHOLESALE', label: 'Wholesale Buyer', icon: '🏢' },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRole(r.id)}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      role === r.id
                        ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <div className="text-lg">{r.icon}</div>
                    <div className="text-[10px] font-bold mt-1 line-clamp-1">{r.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback alerts */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-950/50 border border-red-800 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-emerald-950/60 border border-emerald-800 text-emerald-300 text-xs">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Connecting to Server...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Sign In to Mandi Corridor</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Create Verified {role} Account</span>
              </>
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Fill for Evaluators / Viva */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-2">
            Quick 1-Click Viva Demo Logins:
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleFillDemo('9876543210', 'farmerpassword123')}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[11px] font-semibold text-emerald-300 border border-emerald-800/50"
            >
              🌾 Ramesh Patil (Farmer)
            </button>
            <button
              type="button"
              onClick={() => handleFillDemo('9811223344', 'buyerpassword123')}
              className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-800 text-[11px] font-semibold text-indigo-300 border border-indigo-800/50"
            >
              🏢 KSCF (Buyer)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
