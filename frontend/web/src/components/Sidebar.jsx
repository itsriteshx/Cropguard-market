import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  ShoppingBag,
  PlusCircle,
  MessageSquare,
  TrendingUp,
  FileText,
  ShieldCheck,
  Server,
  Award,
} from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange }) {
  const { t, currentUser } = useAuth();
  const role = currentUser?.role;
  const isFarmer = role === 'FARMER' || role === 'ADMIN';
  const isAdmin = role === 'ADMIN';

  const navItems = [
    {
      id: 'marketplace',
      label: t.nav?.marketplace || 'Marketplace',
      sublabel: 'Browse live harvest lots',
      icon: ShoppingBag,
    },
    ...(isFarmer
      ? [
          {
            id: 'sell',
            label: 'Sell Produce',
            sublabel: 'List harvest & manage lots',
            icon: PlusCircle,
          },
        ]
      : []),
    {
      id: 'negotiations',
      label: 'Negotiations',
      sublabel: 'Live offer & counter-offer room',
      icon: MessageSquare,
    },
    {
      id: 'orders',
      label: t.nav?.orders || 'Orders & Escrow',
      sublabel: 'Track order stages & receipts',
      icon: FileText,
    },
    {
      id: 'mandi',
      label: t.nav?.mandi || 'Mandi Prices & Weather',
      sublabel: 'Live Agmarknet & district weather',
      icon: TrendingUp,
    },
    {
      id: 'compliance',
      label: t.nav?.compliance || 'Audit & Khata',
      sublabel: 'Digital ledger & savings summary',
      icon: ShieldCheck,
    },
    ...(isAdmin
      ? [
          {
            id: 'system',
            label: 'System Diagnostics',
            sublabel: 'Admin gateway status',
            icon: Server,
          },
        ]
      : []),
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 bg-slate-900/60 border-r border-slate-800 p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Workspace
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`w-full text-left p-3 rounded-xl flex items-start gap-3 transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-emerald-950/80 to-slate-900 border border-emerald-600/50 text-white shadow-lg shadow-emerald-950/40'
                  : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 border border-transparent'
              }`}
            >
              <Icon
                className={`w-5 h-5 shrink-0 mt-0.5 ${
                  isActive ? 'text-emerald-400' : 'text-slate-400'
                }`}
              />
              <div className="min-w-0">
                <div className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-300'}`}>
                  {item.label}
                </div>
                <div className="text-[10px] text-slate-500 line-clamp-1">{item.sublabel}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-8 pt-4 border-t border-slate-800/80 px-2">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Award className="w-4 h-4" /> Direct Trade Exchange
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed">
            0% middleman commission. Benchmarked with live Agmarknet mandi rates.
          </p>
        </div>
      </div>
    </aside>
  );
}
