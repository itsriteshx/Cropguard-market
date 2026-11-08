import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Lock,
  Phone,
  User,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  TrendingUp,
  Award,
  Globe,
  ArrowRight,
  Building2,
  Check
} from 'lucide-react';

export default function LoginPage() {
  const { login, register, loading } = useAuth();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('FARMER');
  const [district, setDistrict] = useState('Dharwad');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      } else {
        setError(res.message || 'Registration failed. Please try again.');
      }
    } else {
      const res = await login(phone.trim(), password);
      if (res.success) {
        setSuccessMsg(`Signed in as ${res.user?.name || 'User'}! Redirecting...`);
      } else {
        setError(res.message || 'Invalid credentials. Please verify your phone and password.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between relative overflow-hidden">
      {/* Background Ambient Glow Spheres */}
      <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full opacity-25 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #10b98155 0%, transparent 70%)' }} />
      <div className="absolute top-1/3 -right-32 w-[420px] h-[420px] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #059669aa 0%, transparent 70%)' }} />
      <div className="absolute -bottom-24 left-1/3 w-[360px] h-[360px] rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, #f59e0baa 0%, transparent 70%)' }} />

      {/* Grid Pattern Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundImage: 'linear-gradient(#10b98122 1px, transparent 1px), linear-gradient(90deg, #10b98122 1px, transparent 1px)', backgroundSize: '48px 48px' }} />

      {/* Top Header Bar */}
      <header className="relative z-10 border-b border-slate-900 bg-slate-950/60 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center text-xl shadow-lg shadow-emerald-500/20">
              🌾
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg text-white tracking-tight">CropGuard Market</span>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                  UASD & ICAR Protocol
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Direct Farm-to-Market Exchange Corridor • Karnataka Mandis
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-400 font-mono">Live Gateway :5001</span>
          </div>
        </div>
      </header>

      {/* Main Content Split */}
      <main className="relative z-10 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 flex flex-col lg:flex-row items-center justify-between gap-12">
        {/* Left Column: Brand Hero & Pillars */}
        <div className="max-w-xl text-left">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider border mb-6"
            style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }}>
            <Sparkles className="w-3.5 h-3.5" />
            <span>AUTHENTICATED INSTITUTIONAL ACCESS</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight leading-tight mb-5">
            Trade Agri Lots{' '}
            <span style={{
              background: 'linear-gradient(135deg, #34d399 0%, #10b981 50%, #6ee7b7 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              Directly with Farmers
            </span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 leading-relaxed mb-8">
            Sign in to access Karnataka's statutory agricultural trade corridor.
            Zero middlemen deductions, live APMC benchmarked modal rates, and 100% escrow settlement guaranteed under Section 26.
          </p>

          {/* 4 Trust Highlights */}
          <div className="grid grid-cols-2 gap-3 mb-8">
            {[
              { icon: '🌾', title: '340+ MT Live Harvest', desc: 'Direct from Dharwad, Belagavi FPOs' },
              { icon: '⚡', title: '0.0% Arhatiya Cut', desc: '+10% direct margin to farmers' },
              { icon: '🛡️', title: '100% Escrow Security', desc: 'Protected by ICAR trade contracts' },
              { icon: '🏛️', title: 'APMC Modal Rate Linked', desc: 'Real-time daily mandi discovery' },
            ].map((p, idx) => (
              <div key={idx} className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-sm">
                <div className="text-lg mb-1">{p.icon}</div>
                <div className="text-xs font-bold text-white">{p.title}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{p.desc}</div>
              </div>
            ))}
          </div>

          {/* Institutional Statutory Accreditation Notice */}
          <div className="p-4 rounded-2xl bg-slate-900/40 border border-slate-800 flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-950 border border-emerald-800/80 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-white mb-0.5">
                Statutory Agricultural Regulatory Oversight
              </div>
              <div className="text-[11px] text-slate-400 leading-relaxed">
                Direct farmgate transactions governed under Section 26 of Karnataka APMC Act with ICAR fair-trade protocol.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Authentication Card */}
        <div className="w-full max-w-md">
          <div className="rounded-3xl bg-slate-900/90 border border-slate-800 shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-black text-white">
                  {mode === 'login' ? 'Sign In to Portal' : 'Register New Account'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {mode === 'login'
                    ? 'Enter your mobile number and password.'
                    : 'Create your direct trade account in 30 seconds.'}
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-emerald-950 border border-emerald-800/80 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            {/* Toggle Mode Tabs */}
            <div className="flex p-1 mb-6 rounded-xl bg-slate-950 border border-slate-800 text-xs font-bold">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError('');
                }}
                className={`flex-1 py-2.5 rounded-lg transition-all ${
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
                className={`flex-1 py-2.5 rounded-lg transition-all ${
                  mode === 'register'
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Create Account
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
                    placeholder="10-digit Indian mobile (e.g. 8340476122)"
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
                  <label className="block text-xs font-bold text-slate-300 mb-1.5">Account Role</label>
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

              {/* Feedback messages */}
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
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-950 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Verifying Credentials...</span>
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

            {/* Quick-fill helper */}
            <div className="mt-6 pt-4 border-t border-slate-800 text-center">
              <span className="text-[11px] text-slate-400">
                {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
              </span>
              <button
                type="button"
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError('');
                }}
                className="text-[11px] font-bold text-emerald-400 hover:underline"
              >
                {mode === 'login' ? 'Create new account' : 'Sign in here'}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/60 px-6 py-4 text-center text-xs text-slate-500">
        CropGuard Market &copy; 2026 • UASD Dharwad & ICAR Fair-Trade Protocol • Section 26 APMC Statutory Protection
      </footer>
    </div>
  );
}

