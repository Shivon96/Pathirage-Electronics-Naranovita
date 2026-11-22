import React, { useRef, useState } from 'react';
import {
  BarChart3,
  Home,
  Package,
  QrCode,
  Settings,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { LoginScreen } from './components/LoginScreen';
import { PrintModal } from './components/PrintModal';
import { StoreProvider, useStore } from './context/StoreContext';
import { DashboardPage, type NavTab } from './pages/DashboardPage';
import { PosPage } from './pages/PosPage';
import { SettingsPage } from './pages/SettingsPage';
import { StockRacksPage } from './pages/StockRacksPage';
import { SummaryPage } from './pages/SummaryPage';
import { TicketsPage } from './pages/TicketsPage';
import { BRAND_SUBTITLE, type PrintJob, type RepairTicket } from './types';

const NAV_ITEMS: { id: NavTab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'tickets', label: 'Tickets', icon: Wrench },
  { id: 'pos', label: 'POS', icon: ShoppingCart },
  { id: 'stock', label: 'Stock', icon: Package },
  { id: 'summary', label: 'Summary', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const StoreShell: React.FC = () => {
  const { authMode, snapshot } = useStore();
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [createTicketSignal, setCreateTicketSignal] = useState(0);
  const [printJob, setPrintJob] = useState<PrintJob | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const scanCallbackRef = useRef<((code: string) => void) | null>(null);

  if (authMode === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-700 text-sm font-semibold">
        Loading Store...
      </div>
    );
  }

  if (authMode === 'signed_out') {
    return <LoginScreen />;
  }

  const openScanner = (callback?: (code: string) => void) => {
    scanCallbackRef.current = callback || null;
    setScannerOpen(true);
  };

  const handleBarcodeDetected = (code: string) => {
    setScannerOpen(false);
    if (scanCallbackRef.current) {
      const cb = scanCallbackRef.current;
      scanCallbackRef.current = null;
      cb(code);
      return;
    }
    // Default global scan: check if it matches an inventory item or repair device barcode
    setTicketSearch(code);
    setSelectedTicketId(null);
    setActiveTab('tickets');
  };

  const handleNewRepair = () => {
    setActiveTab('tickets');
    setSelectedTicketId(null);
    setCreateTicketSignal((n) => n + 1);
  };

  const handleSelectTicket = (ticket: RepairTicket) => {
    setSelectedTicketId(ticket.id);
    setActiveTab('tickets');
  };

  const pageTitle = NAV_ITEMS.find((n) => n.id === activeTab)?.label || 'Store';

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Desktop / Tablet Side Navigation Rail */}
      <aside className="no-print hidden md:flex md:flex-col md:w-60 shrink-0 store-header-bg text-white">
        <div className="px-5 py-5 border-b border-white/10">
          <div className="text-xl font-extrabold tracking-tight truncate">{snapshot.shopProfile.shopName || 'Store'}</div>
          <div className="text-[11px] text-slate-300 mt-1 leading-snug">Sahasna Tech Solution · Elpitiya</div>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Primary Sidebar Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full min-h-[46px] px-3.5 rounded-[10px] text-sm font-semibold flex items-center gap-3 transition-colors cursor-pointer whitespace-nowrap ${
                  active ? 'bg-white/15 text-white' : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 text-[11px] text-slate-400">
          {authMode === 'google' ? 'Cloud Sync Connected' : 'Local Browser Storage'}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (3-zone compact) */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <span className="md:hidden text-base font-extrabold text-slate-900 whitespace-nowrap shrink-0">
              {snapshot.shopProfile.shopName || 'Store'}
            </span>
            <h1 className="hidden md:block text-lg font-extrabold text-slate-900 whitespace-nowrap shrink-0">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openScanner()}
              className="min-h-[40px] px-3 border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan</span>
            </button>
            <button
              type="button"
              onClick={handleNewRepair}
              className="min-h-[40px] px-3.5 store-primary-btn text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              + New Repair
            </button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="no-print flex-1 p-4 sm:p-6 pb-24 md:pb-8 max-w-7xl w-full mx-auto">
          {activeTab === 'home' && (
            <DashboardPage
              onNavigate={setActiveTab}
              onNewRepair={handleNewRepair}
              onOpenScanner={() => openScanner()}
              onSelectTicket={handleSelectTicket}
            />
          )}
          {activeTab === 'tickets' && (
            <TicketsPage
              selectedTicketId={selectedTicketId}
              onSelectTicketId={setSelectedTicketId}
              externalSearch={ticketSearch}
              onExternalSearchChange={setTicketSearch}
              openCreateSignal={createTicketSignal}
              onPrint={setPrintJob}
              onScanBarcode={(cb) => openScanner(cb)}
            />
          )}
          {activeTab === 'pos' && (
            <PosPage onPrint={setPrintJob} onScanBarcode={(cb) => openScanner(cb)} />
          )}
          {activeTab === 'stock' && (
            <StockRacksPage onPrint={setPrintJob} onScanBarcode={(cb) => openScanner(cb)} />
          )}
          {activeTab === 'summary' && <SummaryPage onPrint={setPrintJob} />}
          {activeTab === 'settings' && <SettingsPage />}

          <footer className="mt-8 pt-4 border-t border-slate-200 text-center text-xs text-slate-500">
            {BRAND_SUBTITLE}
          </footer>
        </main>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <nav
        className="no-print md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 grid grid-cols-6 h-16"
        aria-label="Mobile Navigation"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-semibold cursor-pointer ${
                active ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="truncate max-w-full px-0.5">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Modals */}
      <BarcodeScannerModal
        open={scannerOpen}
        onClose={() => {
          scanCallbackRef.current = null;
          setScannerOpen(false);
        }}
        onDetected={handleBarcodeDetected}
      />

      <PrintModal job={printJob} onClose={() => setPrintJob(null)} />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <StoreShell />
      </StoreProvider>
    </ErrorBoundary>
  );
}
