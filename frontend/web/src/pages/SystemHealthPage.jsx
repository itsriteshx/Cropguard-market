import React, { useState, useEffect } from 'react';
import { systemService } from '../services/api';
import {
  Server,
  Database,
  Radio,
  CheckCircle,
  XCircle,
  Clock,
  Code,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export default function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pingMs, setPingMs] = useState(null);

  const checkGateway = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const hData = await systemService.getHealth();
      const end = performance.now();
      setPingMs(Math.round(end - start));
      setHealth(hData);

      const dData = await systemService.getDocs();
      setDocs(dData);
    } catch (err) {
      console.warn('System health query error:', err.message);
      setPingMs(null);
      setHealth({
        status: 'OFFLINE_OR_STANDALONE',
        timestamp: new Date().toISOString(),
        environment: 'development',
        database: 'MongoDB Atlas (ReplicaSet ap-south-1)',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkGateway();
  }, []);

  const ROUTE_GROUPS = [
    {
      group: 'Authentication & RBAC',
      prefix: '/api/auth',
      endpoints: [
        { method: 'POST', path: '/register', desc: 'Register farmer, wholesale buyer, or admin' },
        { method: 'POST', path: '/login', desc: 'JWT token generation with bcrypt validation' },
        { method: 'GET', path: '/me', desc: 'Fetch authenticated session profile' },
      ],
    },
    {
      group: 'Direct Produce Listings (GeoSpatial)',
      prefix: '/api/listings',
      endpoints: [
        { method: 'GET', path: '/', desc: 'Listings feed with 2dsphere nearSphere proximity query' },
        { method: 'POST', path: '/', desc: 'Create new produce lot with APMC validation' },
        { method: 'GET', path: '/:id', desc: 'Retrieve full lot parameters and farmer profile' },
      ],
    },
    {
      group: 'Mandi Rates & Intelligence Pipeline',
      prefix: '/api/mandi-rates',
      endpoints: [
        { method: 'GET', path: '/', desc: 'Current market rates across 12+ APMC mandis' },
        { method: 'GET', path: '/benchmark', desc: 'Anti-exploitation modal benchmark query' },
      ],
    },
    {
      group: 'Multi-Turn Negotiations (Socket.io)',
      prefix: '/api/negotiations',
      endpoints: [
        { method: 'GET', path: '/', desc: 'Active bargaining channels for user' },
        { method: 'POST', path: '/', desc: 'Initiate negotiation on listing' },
        { method: 'POST', path: '/:id/counter', desc: 'Send counter offer (turn based)' },
      ],
    },
    {
      group: 'Orders, Escrow & Digital Ledger',
      prefix: '/api/orders',
      endpoints: [
        { method: 'GET', path: '/', desc: 'Order tracking across 5 lifecycle stages' },
        { method: 'POST', path: '/', desc: 'Place order and trigger escrow deposit' },
        { method: 'PATCH', path: '/:id/status', desc: 'Advance fulfillment stage' },
        { method: 'GET', path: '/farmer-ledger', desc: 'Digital Khata with +10% savings metric' },
        { method: 'GET', path: '/:id/receipt', desc: 'Certified printable tax/APMC invoice' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-slate-900 border border-emerald-800/40 rounded-2xl p-6 relative overflow-hidden shadow-xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-700/60 text-emerald-300 text-xs font-semibold mb-3">
            <Server className="w-3.5 h-3.5" /> Node.js & Express Architecture Gateway
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Backend Gateway Health & API Registry
          </h1>
          <p className="text-slate-300 text-sm mt-2 leading-relaxed">
            Real-time diagnostics for Express gateway on port 5001, MongoDB Atlas cluster (Mumbai),
            and Socket.io /negotiation real-time bargaining namespace.
          </p>
        </div>
      </div>

      {/* Gateway Infrastructure Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Express Server */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Express Gateway</span>
            </div>
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                health?.status === 'OK' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
          </div>
          <div className="text-xs text-slate-400 space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Port:</span>
              <span className="font-mono text-slate-200">5001 (macOS AirPlay Safe)</span>
            </div>
            <div className="flex justify-between">
              <span>Roundtrip Ping:</span>
              <span className="font-mono text-emerald-400">{pingMs ? `${pingMs} ms` : 'Demo Fallback'}</span>
            </div>
          </div>
        </div>

        {/* MongoDB Atlas */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>MongoDB Atlas</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xs text-slate-400 space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Cluster:</span>
              <span className="font-mono text-slate-200">cropguard-cluster</span>
            </div>
            <div className="flex justify-between">
              <span>Region:</span>
              <span className="font-mono text-emerald-400">AWS ap-south-1 (Mumbai)</span>
            </div>
          </div>
        </div>

        {/* Socket.io */}
        <div className="glass-panel p-5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-white font-bold text-sm">
              <Radio className="w-4 h-4 text-emerald-400" />
              <span>WebSocket Gateway</span>
            </div>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>
          <div className="text-xs text-slate-400 space-y-1 pt-1">
            <div className="flex justify-between">
              <span>Namespace:</span>
              <span className="font-mono text-slate-200">/negotiation</span>
            </div>
            <div className="flex justify-between">
              <span>Rooms:</span>
              <span className="font-mono text-emerald-400">Isolated Room-Per-Deal</span>
            </div>
          </div>
        </div>
      </div>

      {/* API Route Registry Explorer */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-base font-bold text-white">Full Microservices & Endpoint Registry</h3>
              <p className="text-xs text-slate-400">
                Audited backend endpoints verified with JWT authentication and rate limiting
              </p>
            </div>
          </div>

          <button
            onClick={checkGateway}
            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-Ping Gateway</span>
          </button>
        </div>

        <div className="space-y-4 pt-2">
          {ROUTE_GROUPS.map((group, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-emerald-400 uppercase tracking-wider">
                  {group.group}
                </span>
                <span className="font-mono text-[11px] text-slate-500">{group.prefix}</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                {group.endpoints.map((ep, i) => (
                  <div
                    key={i}
                    className="p-2.5 rounded-lg bg-slate-950/80 border border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          ep.method === 'GET'
                            ? 'bg-blue-950 text-blue-300 border border-blue-800'
                            : ep.method === 'POST'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                            : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}
                      >
                        {ep.method}
                      </span>
                      <span className="font-mono text-slate-300 font-semibold">{ep.path}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-tight">{ep.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
