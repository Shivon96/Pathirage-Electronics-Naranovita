import React from 'react';
import {
  AlertTriangle,
  BarChart3,
  Package,
  QrCode,
  Settings,
  ShoppingCart,
  Wrench,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { RepairTicket } from '../types';
import { computeSummaryMetrics, getDayBounds } from '../utils/summaryMetrics';
import { formatMoney } from '../utils/validation';

export type NavTab = 'home' | 'tickets' | 'pos' | 'stock' | 'summary' | 'settings';

interface DashboardPageProps {
  onNavigate: (tab: NavTab) => void;
  onNewRepair: () => void;
  onOpenScanner: () => void;
  onSelectTicket: (ticket: RepairTicket) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  onNewRepair,
  onOpenScanner,
  onSelectTicket,
}) => {
  const { snapshot } = useStore();
  const currency = snapshot.shopProfile.currencySymbol || 'Rs.';
  const todayStr = new Date().toISOString().slice(0, 10);
  const { start, end } = getDayBounds(todayStr);
  const todayMetrics = computeSummaryMetrics(snapshot, start, end);

  const activeTickets = snapshot.tickets.filter((t) => t.status !== 'Delivered');
  const readyTickets = snapshot.tickets.filter((t) => t.status === 'Ready for Pickup');
  const lowStockCount = snapshot.inventory.filter((i) => i.qty <= i.minQty).length;

  const tiles = [
    {
      label: 'New Repair',
      sub: 'Intake & sticker',
      icon: Wrench,
      action: onNewRepair,
      accent: 'text-blue-700 bg-blue-50',
    },
    {
      label: 'POS Bill',
      sub: 'Counter sale',
      icon: ShoppingCart,
      action: () => onNavigate('pos'),
      accent: 'text-emerald-700 bg-emerald-50',
    },
    {
      label: 'Scan Code',
      sub: 'History or item',
      icon: QrCode,
      action: onOpenScanner,
      accent: 'text-indigo-700 bg-indigo-50',
    },
    {
      label: 'Stock & Racks',
      sub: `${snapshot.inventory.length} items`,
      icon: Package,
      action: () => onNavigate('stock'),
      accent: 'text-amber-700 bg-amber-50',
    },
    {
      label: 'Summary',
      sub: 'Daily & monthly',
      icon: BarChart3,
      action: () => onNavigate('summary'),
      accent: 'text-teal-700 bg-teal-50',
    },
    {
      label: 'Settings',
      sub: 'Sync, theme & admin',
      icon: Settings,
      action: () => onNavigate('settings'),
      accent: 'text-slate-700 bg-slate-100',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 2x3 Quick Menu Tiles */}
      <section aria-label="Quick Menu">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-slate-900">Quick Actions</h2>
          <span className="text-xs text-slate-500 font-mono-num">{todayStr}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
          {tiles.map((tile) => {
            const Icon = tile.icon;
            return (
              <button
                key={tile.label}
                type="button"
                onClick={tile.action}
                className="store-card border border-slate-200 hover:border-blue-600 p-4 min-h-[88px] text-left flex items-center gap-3.5 transition-colors cursor-pointer group"
              >
                <div className={`w-12 h-12 rounded-[10px] flex items-center justify-center shrink-0 ${tile.accent}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <div className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-blue-700 truncate">
                    {tile.label}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{tile.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Today's Stats Strip */}
      <section aria-label="Today's Stats">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="store-card border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500">Collected Today</div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-num text-slate-900 mt-1">
              {formatMoney(todayMetrics.totalCollected, currency)}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              POS {todayMetrics.posSalesCount} · Tickets {todayMetrics.ticketSettlementsCount + todayMetrics.advanceDepositsCount}
            </div>
          </div>

          <div className="store-card border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500">Active Repairs</div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-num text-blue-700 mt-1">
              {activeTickets.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              {todayMetrics.newIntakesCount} new intake{todayMetrics.newIntakesCount === 1 ? '' : 's'} today
            </div>
          </div>

          <div className="store-card border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500">Ready for Pickup</div>
            <div className="text-xl sm:text-2xl font-extrabold font-mono-num text-emerald-700 mt-1">
              {readyTickets.length}
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Balance due {formatMoney(todayMetrics.openBalancesTotal, currency)}
            </div>
          </div>

          <div className="store-card border border-slate-200 p-4">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              {lowStockCount > 0 && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
              <span>Low Stock Alerts</span>
            </div>
            <div
              className={`text-xl sm:text-2xl font-extrabold font-mono-num mt-1 ${
                lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900'
              }`}
            >
              {lowStockCount}
            </div>
            <button
              type="button"
              onClick={() => onNavigate('stock')}
              className="text-xs font-semibold text-blue-700 hover:underline mt-1 cursor-pointer"
            >
              Manage Stock &amp; Racks
            </button>
          </div>
        </div>
      </section>

      {/* Active Repair Jobs */}
      <section className="store-card border border-slate-200 overflow-hidden">
        <div className="px-4 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Active Repair Jobs</h2>
            <p className="text-xs text-slate-500">Tap any ticket to inspect, attach spare parts, or settle</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('tickets')}
            className="min-h-[40px] px-3 text-xs font-semibold text-blue-700 hover:bg-blue-50 rounded-[8px] whitespace-nowrap shrink-0 cursor-pointer"
          >
            View All ({snapshot.tickets.length})
          </button>
        </div>

        {activeTickets.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-slate-600 mb-3">No active repair jobs in the queue right now.</p>
            <button
              type="button"
              onClick={onNewRepair}
              className="min-h-[48px] px-5 store-primary-btn text-sm font-semibold cursor-pointer"
            >
              Create First Repair Ticket
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {activeTickets.slice(0, 8).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTicket(t)}
                className="w-full text-left px-4 py-3.5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2 cursor-pointer"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                    <span className="font-mono-num text-blue-700">{t.ticketNo}</span>
                    <span aria-hidden="true">·</span>
                    <span className="truncate">{t.customerName}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5 truncate">
                    {t.deviceType} {t.deviceBrand} {t.deviceModel} · Code{' '}
                    <span className="font-mono-num">{t.deviceBarcode}</span> · {t.faultDescription}
                  </div>
                </div>
                <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 text-xs">
                  <span
                    className={`font-semibold ${
                      t.status === 'Ready for Pickup'
                        ? 'text-emerald-700'
                        : t.status === 'Diagnosing'
                        ? 'text-amber-700'
                        : 'text-slate-700'
                    }`}
                  >
                    {t.status}
                  </span>
                  <span className="font-mono-num font-bold text-slate-900">
                    Bal {formatMoney(t.balanceDue, currency)}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
