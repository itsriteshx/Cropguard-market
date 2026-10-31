import React, { useState } from 'react';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MarketplacePage from './pages/MarketplacePage';
import MandiAnalyticsPage from './pages/MandiAnalyticsPage';
import OrdersEscrowPage from './pages/OrdersEscrowPage';
import ComplianceAuditPage from './pages/ComplianceAuditPage';
import SystemHealthPage from './pages/SystemHealthPage';

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('marketplace');

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      {/* Top Navigation */}
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Body */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        {/* Navigation Sidebar */}
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab View Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'marketplace' && <MarketplacePage />}
          {activeTab === 'mandi' && <MandiAnalyticsPage />}
          {activeTab === 'orders' && <OrdersEscrowPage />}
          {activeTab === 'compliance' && <ComplianceAuditPage />}
          {activeTab === 'system' && <SystemHealthPage />}
        </main>
      </div>

      {/* Sticky Bottom Status Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            CropGuard Market &copy; 2026 • UASD Dharwad & Ministry of Agriculture Fair-Trade Protocol
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>DE / Web Track</span>
            <span>•</span>
            <span className="text-emerald-400 font-semibold">Zero Commission Architecture</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <DashboardContent />
    </AuthProvider>
  );
}
