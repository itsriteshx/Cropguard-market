import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import MarketplacePage from './pages/MarketplacePage';
import SellProducePage from './pages/SellProducePage';
import NegotiationsPage from './pages/NegotiationsPage';
import MandiAnalyticsPage from './pages/MandiAnalyticsPage';
import OrdersEscrowPage from './pages/OrdersEscrowPage';
import ComplianceAuditPage from './pages/ComplianceAuditPage';
import SystemHealthPage from './pages/SystemHealthPage';
import LoginPage from './pages/LoginPage';

function DashboardContent() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('marketplace');

  // Gatekeeper: Require sign-in before accessing workspace
  if (!currentUser) {
    return <LoginPage />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Navbar activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 max-w-7xl w-full mx-auto flex flex-col md:flex-row">
        <Sidebar activeTab={activeTab} onTabChange={setActiveTab} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {activeTab === 'marketplace' && (
            <MarketplacePage
              onNavigateToSell={() => setActiveTab('sell')}
              onNavigateToNegotiations={() => setActiveTab('negotiations')}
              onNavigateToMandi={() => setActiveTab('mandi')}
            />
          )}
          {activeTab === 'sell' && (
            <SellProducePage onNavigateToMarket={() => setActiveTab('marketplace')} />
          )}
          {activeTab === 'negotiations' && (
            <NegotiationsPage onNavigateToOrders={() => setActiveTab('orders')} />
          )}
          {activeTab === 'mandi' && <MandiAnalyticsPage />}
          {activeTab === 'orders' && <OrdersEscrowPage />}
          {activeTab === 'compliance' && <ComplianceAuditPage />}
          {activeTab === 'system' && currentUser?.role === 'ADMIN' && <SystemHealthPage />}
        </main>
      </div>

      <footer className="border-t border-slate-900 bg-slate-950/80 px-4 py-3 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>CropGuard Market &copy; 2026 • Direct Farmer-to-Buyer Mandi Platform</div>
          <div className="text-[11px] text-emerald-400 font-semibold">
            Zero Commission Exchange
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
