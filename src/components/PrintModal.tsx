import React, { useEffect } from 'react';
import { Printer, X } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import { BRAND_FOOTER, type PrintJob } from '../types';
import { formatMoney } from '../utils/validation';

interface PrintModalProps {
  job: PrintJob | null;
  onClose: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({ job, onClose }) => {
  const { snapshot } = useStore();
  const profile = snapshot.shopProfile;
  const currency = profile.currencySymbol || 'Rs.';
  const footer = profile.receiptFooter || BRAND_FOOTER;

  const isLabel = job?.type === 'part-label' || job?.type === 'rack-label' || job?.type === 'intake-sticker';

  useEffect(() => {
    if (!job) return;
    document.body.classList.remove('print-mode-label', 'print-mode-receipt');
    document.body.classList.add(isLabel ? 'print-mode-label' : 'print-mode-receipt');
    return () => {
      document.body.classList.remove('print-mode-label', 'print-mode-receipt');
    };
  }, [job, isLabel]);

  if (!job) return null;

  const triggerPrint = () => {
    window.print();
  };

  return (
    <>
      {/* Screen Preview Modal */}
      <div className="no-print fixed inset-0 z-50 bg-slate-900/70 flex items-center justify-center p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-md bg-white rounded-[10px] border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
          <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              <h2 className="text-base font-bold">
                {isLabel ? '58mm × 50mm Thermal Label' : '58mm Thermal Receipt'}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-[8px] hover:bg-slate-700 cursor-pointer"
              aria-label="Close print preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 overflow-y-auto bg-slate-100 flex justify-center">
            <div
              className="bg-white text-black border border-slate-300 shadow-sm p-2"
              style={{
                width: '58mm',
                minHeight: isLabel ? '50mm' : undefined,
              }}
            >
              <PrintSheetContent job={job} shopName={profile.shopName} shopPhone={profile.shopPhone} shopAddress={profile.shopAddress} currency={currency} footer={footer} />
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 flex gap-3 bg-white">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-[48px] px-4 border border-slate-300 rounded-[10px] font-semibold text-sm text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={triggerPrint}
              className="flex-1 min-h-[48px] px-4 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print 58mm</span>
            </button>
          </div>
        </div>
      </div>

      {/* Actual Print Output Root (hidden on screen, shown on @media print) */}
      <div className="hidden print-only-root">
        <PrintSheetContent
          job={job}
          shopName={profile.shopName}
          shopPhone={profile.shopPhone}
          shopAddress={profile.shopAddress}
          currency={currency}
          footer={footer}
        />
      </div>
    </>
  );
};

interface PrintSheetContentProps {
  job: PrintJob;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  currency: string;
  footer: string;
}

const PrintSheetContent: React.FC<PrintSheetContentProps> = ({
  job,
  shopName,
  shopPhone,
  shopAddress,
  currency,
  footer,
}) => {
  // 1. Single Spare Part Label (58mm x 50mm): BIG bold Item Name + extra-big RACK ONLY (NO barcode, SKU, or price)
  if (job.type === 'part-label') {
    return (
      <div className="w-full h-full flex flex-col justify-between text-center p-1 leading-tight text-black">
        <div className="text-[16px] font-extrabold uppercase tracking-tight break-words line-clamp-3">
          {job.item.name}
        </div>
        <div className="border-t-2 border-black pt-1.5 mt-1">
          <div className="text-[22px] font-black tracking-tight leading-none">
            RACK: {job.item.shelfLocation || 'N/A'}
          </div>
        </div>
      </div>
    );
  }

  // 2. Rack Label (58mm x 50mm): BIG bold RACK + all items assigned to that rack ONLY (NO barcode)
  if (job.type === 'rack-label') {
    return (
      <div className="w-full h-full flex flex-col text-black p-1 leading-tight">
        <div className="text-[20px] font-black text-center border-b-2 border-black pb-1 mb-1">
          RACK: {job.rackName || 'UNASSIGNED'}
        </div>
        <div className="text-[11px] font-bold space-y-0.5 overflow-hidden">
          {job.items.length === 0 ? (
            <div className="text-center italic">No items assigned</div>
          ) : (
            job.items.map((it) => (
              <div key={it.id} className="truncate">
                • {it.name}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // 3. Device Intake Sticker (58mm x 50mm)
  if (job.type === 'intake-sticker') {
    const t = job.ticket;
    return (
      <div className="w-full h-full flex flex-col justify-between text-black p-1 leading-tight text-[11px]">
        <div className="border-b border-black pb-0.5 flex items-center justify-between font-black">
          <span className="text-[15px]">{t.ticketNo}</span>
          <span className="text-[10px] font-mono">{new Date(t.createdAtMs).toLocaleDateString()}</span>
        </div>
        <div className="space-y-0.5 my-1">
          <div className="font-extrabold text-[12px] truncate">{t.customerName}</div>
          <div className="font-bold truncate">
            {t.deviceType} {t.deviceBrand} {t.deviceModel}
          </div>
          <div className="text-[10px] line-clamp-2">{t.faultDescription}</div>
        </div>
        <div className="border-t border-black pt-0.5 flex items-center justify-between font-mono font-bold text-[11px]">
          <span>ID: {t.deviceBarcode}</span>
          <span>{t.customerPhone}</span>
        </div>
      </div>
    );
  }

  // 4. Customer Repair Receipt (58mm)
  if (job.type === 'ticket-receipt') {
    const { ticket, parts } = job;
    return (
      <div className="w-full text-black text-[11px] leading-snug font-sans">
        <div className="text-center border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="text-[14px] font-black uppercase">{shopName}</div>
          {shopAddress && <div className="text-[10px]">{shopAddress}</div>}
          {shopPhone && <div className="text-[10px] font-bold">Tel: {shopPhone}</div>}
        </div>
        <div className="space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="flex justify-between font-bold">
            <span>Ticket: {ticket.ticketNo}</span>
            <span>{ticket.status}</span>
          </div>
          <div>Date: {new Date(ticket.createdAtMs).toLocaleString()}</div>
          <div>Customer: {ticket.customerName}</div>
          {ticket.customerPhone && <div>Phone: {ticket.customerPhone}</div>}
          <div>
            Device: {ticket.deviceType} {ticket.deviceBrand} {ticket.deviceModel}
          </div>
          <div className="font-mono">Code: {ticket.deviceBarcode}</div>
        </div>

        <div className="border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="font-bold mb-0.5">Parts &amp; Service</div>
          {parts.map((p) => (
            <div key={p.id} className="flex justify-between gap-1">
              <span className="truncate">
                {p.itemName} ×{p.qty}
              </span>
              <span className="font-mono shrink-0">{p.lineTotal.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between gap-1">
            <span>Labor / Service</span>
            <span className="font-mono">{ticket.laborCharge.toFixed(2)}</span>
          </div>
          {ticket.discount > 0 && (
            <div className="flex justify-between gap-1">
              <span>Discount</span>
              <span className="font-mono">-{ticket.discount.toFixed(2)}</span>
            </div>
          )}
        </div>

        <div className="space-y-0.5 font-bold border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="flex justify-between text-[13px]">
            <span>TOTAL</span>
            <span className="font-mono">{formatMoney(ticket.totalAmount, currency)}</span>
          </div>
          {ticket.advanceDeposit > 0 && (
            <div className="flex justify-between font-normal">
              <span>Advance ({ticket.depositMethod})</span>
              <span className="font-mono">{ticket.advanceDeposit.toFixed(2)}</span>
            </div>
          )}
          {ticket.settledAmount > 0 && (
            <div className="flex justify-between font-normal">
              <span>Settled ({ticket.settlementMethod})</span>
              <span className="font-mono">{ticket.settledAmount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[12px]">
            <span>BALANCE DUE</span>
            <span className="font-mono">{formatMoney(ticket.balanceDue, currency)}</span>
          </div>
        </div>

        <div className="text-center text-[9px] pt-1 leading-tight">{footer}</div>
      </div>
    );
  }

  // 5. POS Counter Sale Receipt (58mm)
  if (job.type === 'pos-receipt') {
    const { sale, items } = job;
    return (
      <div className="w-full text-black text-[11px] leading-snug">
        <div className="text-center border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="text-[14px] font-black uppercase">{shopName}</div>
          {shopAddress && <div className="text-[10px]">{shopAddress}</div>}
          {shopPhone && <div className="text-[10px] font-bold">Tel: {shopPhone}</div>}
        </div>
        <div className="space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="flex justify-between font-bold">
            <span>Bill: {sale.saleNo}</span>
            <span>{sale.paymentMethod}</span>
          </div>
          <div>Date: {new Date(sale.createdAtMs).toLocaleString()}</div>
          {sale.customerName && <div>Customer: {sale.customerName}</div>}
        </div>

        <div className="border-b border-dashed border-black pb-1.5 mb-1.5 space-y-0.5">
          {items.map((it) => (
            <div key={it.id}>
              <div className="font-semibold truncate">{it.itemName}</div>
              <div className="flex justify-between text-[10px] font-mono">
                <span>
                  {it.qty} × {it.unitPrice.toFixed(2)}
                </span>
                <span>{it.lineTotal.toFixed(2)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span className="font-mono">{sale.subtotal.toFixed(2)}</span>
          </div>
          {sale.discount > 0 && (
            <div className="flex justify-between">
              <span>Discount</span>
              <span className="font-mono">-{sale.discount.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-[13px] font-black">
            <span>TOTAL</span>
            <span className="font-mono">{formatMoney(sale.totalAmount, currency)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Tendered</span>
            <span className="font-mono">{sale.amountTendered.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span>Change</span>
            <span className="font-mono">{sale.changeDue.toFixed(2)}</span>
          </div>
        </div>

        <div className="text-center text-[9px] pt-1 leading-tight">{footer}</div>
      </div>
    );
  }

  // 6. Summary Report (58mm)
  const { mode, periodLabel, metrics } = job;
  return (
    <div className="w-full text-black text-[11px] leading-snug">
      <div className="text-center border-b border-dashed border-black pb-1.5 mb-1.5">
        <div className="text-[14px] font-black uppercase">{shopName}</div>
        <div className="text-[11px] font-bold">{mode === 'daily' ? 'DAILY SUMMARY' : 'MONTHLY SUMMARY'}</div>
        <div className="text-[10px]">{periodLabel}</div>
      </div>
      <div className="space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
        <div className="flex justify-between font-black text-[12px]">
          <span>TOTAL COLLECTED</span>
          <span className="font-mono">{formatMoney(metrics.totalCollected, currency)}</span>
        </div>
        <div className="flex justify-between">
          <span>POS Sales ({metrics.posSalesCount})</span>
          <span className="font-mono">{metrics.posSalesTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Settlements ({metrics.ticketSettlementsCount})</span>
          <span className="font-mono">{metrics.ticketSettlementsTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Deposits ({metrics.advanceDepositsCount})</span>
          <span className="font-mono">{metrics.advanceDepositsTotal.toFixed(2)}</span>
        </div>
      </div>
      <div className="space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
        <div className="flex justify-between">
          <span>Cash</span>
          <span className="font-mono">{metrics.cashTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Card</span>
          <span className="font-mono">{metrics.cardTotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between">
          <span>Online</span>
          <span className="font-mono">{metrics.onlineTotal.toFixed(2)}</span>
        </div>
      </div>
      <div className="space-y-0.5 border-b border-dashed border-black pb-1.5 mb-1.5">
        <div className="flex justify-between">
          <span>New Intakes</span>
          <span className="font-mono">{metrics.newIntakesCount}</span>
        </div>
        <div className="flex justify-between">
          <span>Ready / Delivered</span>
          <span className="font-mono">
            {metrics.readyCount} / {metrics.deliveredCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Open Balances</span>
          <span className="font-mono">{metrics.openBalancesTotal.toFixed(2)}</span>
        </div>
      </div>
      <div className="text-center text-[9px] pt-1 leading-tight">{footer}</div>
    </div>
  );
};
