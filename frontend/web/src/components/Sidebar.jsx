import React from 'react';
import {
  ShoppingBag,
  TrendingUp,
  FileText,
  ShieldCheck,
  Server,
  Building2,
  Users,
  Award,
} from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange }) {
  const navItems = [
    {
      id: 'marketplace',
      label: 'Wholesale Marketplace',
      sublabel: 'Direct Bulk Farm Lots (20-500 qtl)',
      icon: ShoppingBag,
    },
    {
      id: 'mandi',
      label: 'APMC Mandi Intelligence',
      sublabel: 'Price Trends & Modal Spread',
      icon: TrendingUp,
    },
    {
      id: 'orders',
      label: 'Bulk Orders & Escrow',
      sublabel: 'Fulfillment & Settlement Pipeline',
      icon: FileText,
    },
    {
      id: 'compliance',
      label: 'Audit & Fair-Trade',
      sublabel: 'Digital Khata & +10% Savings',
      icon: ShieldCheck,
    },
    {
      id: 'system',
      label: 'API Gateway & Docs',
      sublabel: 'Backend Health & Swagger Specs',
      icon: Server,
    },
  ];

  return (
    <aside className="w-full md:w-64 shrink-0 bg-slate-900/60 border-r border-slate-800 p-4 flex flex-col justify-between">
      <div className="space-y-1">
        <div className="px-3 py-2 text-[10px] uppercase font-bold tracking-wider text-slate-500">
          Core Navigation
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

      {/* Institutional Governance Footer */}
      <div className="mt-8 pt-4 border-t border-slate-800/80 px-2 space-y-3">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1.5">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
            <Award className="w-4 h-4" /> ICAR & UASD Compliant
          </div>
          <p className="text-slate-400 text-[10px] leading-relaxed">
            Eliminates APMC commission agents (arhatiyas) to transfer +10% economic value directly to farmers.
          </p>
        </div>

        <div className="text-[10px] text-slate-500 text-center">
          CropGuard Market v1.0 • DE Track
        </div>
      </div>
    </aside>
  );
}
