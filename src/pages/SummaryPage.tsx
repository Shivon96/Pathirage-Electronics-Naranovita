import React, { useMemo, useState } from 'react';
import { BarChart3, Printer } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { PrintJob } from '../types';
import { computeSummaryMetrics, getDayBounds, getMonthBounds } from '../utils/summaryMetrics';
import { formatMoney } from '../utils/validation';

interface SummaryPageProps {
  onPrint: (job: PrintJob) => void;
}

export const SummaryPage: React.FC<SummaryPageProps> = ({ onPrint }) => {
  const { snapshot } = useStore();
  const currency = snapshot.shopProfile.currencySymbol || 'Rs.';

  const [mode, setMode] = useState<'daily' | 'monthly'>('daily');
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const bounds = useMemo(() => {
    return mode === 'daily' ? getDayBounds(selectedDay) : getMonthBounds(selectedMonth);
  }, [mode, selectedDay, selectedMonth]);

  const metrics = useMemo(
    () => computeSummaryMetrics(snapshot, bounds.start, bounds.end),
    [snapshot, bounds]
  );

  // Daily breakdown rows for Monthly view
  const monthlyDailyRows = useMemo(() => {
    if (mode !== 'monthly') return [];
    const [y, m] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(y, m || 1, 0).getDate();
    const rows: {
      dateStr: string;
      collected: number;
      posSales: number;
      ticketsPaid: number;
      intakes: number;
    }[] = [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${selectedMonth}-${String(d).padStart(2, '0')}`;
      const { start, end } = getDayBounds(dateStr);
      const dm = computeSummaryMetrics(snapshot, start, end);
      if (dm.totalCollected > 0 || dm.newIntakesCount > 0) {
        rows.push({
          dateStr,
          collected: dm.totalCollected,
          posSales: dm.posSalesTotal,
          ticketsPaid: dm.ticketSettlementsTotal + dm.advanceDepositsTotal,
          intakes: dm.newIntakesCount,
        });
      }
    }
    return rows;
  }, [mode, selectedMonth, snapshot]);

  const periodLabel = mode === 'daily' ? selectedDay : selectedMonth;

  return (
    <div className="space-y-4">
      <div className="store-card border border-slate-200 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-[10px]">
            <button
              type="button"
              onClick={() => setMode('daily')}
              className={`min-h-[40px] px-4 text-xs sm:text-sm font-semibold rounded-[8px] cursor-pointer ${
                mode === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Daily Summary
            </button>
            <button
              type="button"
              onClick={() => setMode('monthly')}
              className={`min-h-[40px] px-4 text-xs sm:text-sm font-semibold rounded-[8px] cursor-pointer ${
                mode === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Monthly Summary
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {mode === 'daily' ? (
            <input
              type="date"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="min-h-[42px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
            />
          ) : (
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="min-h-[42px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
            />
          )}
          <button
            type="button"
            onClick={() =>
              onPrint({
                type: 'summary-report',
                mode,
                periodLabel,
                metrics,
              })
            }
            className="min-h-[42px] px-4 store-primary-btn text-xs sm:text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>58mm Summary</span>
          </button>
        </div>
      </div>

      {/* Revenue Hero Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="store-card border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">Total Collected Revenue</div>
          <div className="text-2xl font-extrabold font-mono-num text-blue-700 mt-1">
            {formatMoney(metrics.totalCollected, currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1">POS + Settlements + Deposits</div>
        </div>

        <div className="store-card border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">POS Counter Sales</div>
          <div className="text-2xl font-extrabold font-mono-num text-slate-900 mt-1">
            {formatMoney(metrics.posSalesTotal, currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-num">{metrics.posSalesCount} sale(s)</div>
        </div>

        <div className="store-card border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">Ticket Settlements</div>
          <div className="text-2xl font-extrabold font-mono-num text-slate-900 mt-1">
            {formatMoney(metrics.ticketSettlementsTotal, currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-num">
            {metrics.ticketSettlementsCount} settled
          </div>
        </div>

        <div className="store-card border border-slate-200 p-4">
          <div className="text-xs font-semibold text-slate-500">Advance Deposits</div>
          <div className="text-2xl font-extrabold font-mono-num text-slate-900 mt-1">
            {formatMoney(metrics.advanceDepositsTotal, currency)}
          </div>
          <div className="text-xs text-slate-500 mt-1 font-mono-num">
            {metrics.advanceDepositsCount} deposit(s)
          </div>
        </div>
      </div>

      {/* Payment Breakdown & Workshop Operational Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="store-card border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-700" />
            <span>Payment Method Breakdown</span>
          </h3>
          <div className="divide-y divide-slate-200 text-sm">
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600">Cash Collected</span>
              <span className="font-mono-num font-bold">{formatMoney(metrics.cashTotal, currency)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600">Card Collected</span>
              <span className="font-mono-num font-bold">{formatMoney(metrics.cardTotal, currency)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600">Online / Transfer Collected</span>
              <span className="font-mono-num font-bold">{formatMoney(metrics.onlineTotal, currency)}</span>
            </div>
            <div className="py-2.5 flex justify-between">
              <span className="text-slate-600">Open Ticket Balances (All Pending)</span>
              <span className="font-mono-num font-bold text-amber-700">
                {formatMoney(metrics.openBalancesTotal, currency)}
              </span>
            </div>
          </div>
        </div>

        <div className="store-card border border-slate-200 p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">Workshop &amp; Stock Operations</h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200">
              <div className="text-xs text-slate-500">New Intakes</div>
              <div className="text-lg font-extrabold font-mono-num">{metrics.newIntakesCount}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200">
              <div className="text-xs text-slate-500">Ready / Delivered</div>
              <div className="text-lg font-extrabold font-mono-num">
                {metrics.readyCount} / {metrics.deliveredCount}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200">
              <div className="text-xs text-slate-500">Parts Billed</div>
              <div className="text-base font-extrabold font-mono-num">
                {formatMoney(metrics.partsBilledTotal, currency)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200">
              <div className="text-xs text-slate-500">Labor Billed</div>
              <div className="text-base font-extrabold font-mono-num">
                {formatMoney(metrics.laborBilledTotal, currency)}
              </div>
            </div>
            <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200">
              <div className="text-xs text-slate-500">Bookings Created</div>
              <div className="text-lg font-extrabold font-mono-num">{metrics.bookingsCount}</div>
            </div>
            <div className="p-3 bg-slate-50 rounded-[8px] border border-slate-200">
              <div className="text-xs text-slate-500">Total Stock In / Out</div>
              <div className="text-lg font-extrabold font-mono-num">
                {metrics.stockInTotal} / {metrics.stockOutTotal}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Breakdown Table (Monthly Mode) */}
      {mode === 'monthly' && (
        <div className="store-card border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200">
            <h3 className="text-sm font-bold text-slate-900">Daily Breakdown ({selectedMonth})</h3>
          </div>
          {monthlyDailyRows.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">No activity recorded for this month.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-xs text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-2.5 font-semibold">Date</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Intakes</th>
                    <th className="px-4 py-2.5 font-semibold text-right">POS Sales</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Ticket Pay</th>
                    <th className="px-4 py-2.5 font-semibold text-right">Total Collected</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {monthlyDailyRows.map((row) => (
                    <tr key={row.dateStr} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono-num font-semibold">{row.dateStr}</td>
                      <td className="px-4 py-2.5 font-mono-num text-right">{row.intakes}</td>
                      <td className="px-4 py-2.5 font-mono-num text-right">{formatMoney(row.posSales, currency)}</td>
                      <td className="px-4 py-2.5 font-mono-num text-right">{formatMoney(row.ticketsPaid, currency)}</td>
                      <td className="px-4 py-2.5 font-mono-num font-bold text-right">
                        {formatMoney(row.collected, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
