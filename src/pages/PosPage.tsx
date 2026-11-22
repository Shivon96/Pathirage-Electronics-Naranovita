import React, { useMemo, useState } from 'react';
import { Minus, Plus, Printer, QrCode, Search, ShoppingBag, Trash2 } from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { InventoryItem, PaymentMethod, PrintJob } from '../types';
import { formatMoney, multiTokenMatch } from '../utils/validation';

interface PosPageProps {
  onPrint: (job: PrintJob) => void;
  onScanBarcode: (callback: (code: string) => void) => void;
}

interface CartLine {
  key: string;
  inventoryItemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
}

export const PosPage: React.FC<PosPageProps> = ({ onPrint, onScanBarcode }) => {
  const { snapshot, completePosSale } = useStore();
  const currency = snapshot.shopProfile.currencySymbol || 'Rs.';

  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [customerName, setCustomerName] = useState('Walk-in');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [tendered, setTendered] = useState('');
  const [busy, setBusy] = useState(false);

  const rankedCatalog = useMemo(() => {
    const matches = snapshot.inventory.filter((it) =>
      multiTokenMatch(`${it.name} ${it.sku} ${it.barcode} ${it.shelfLocation}`, search)
    );
    return matches.sort((a, b) => {
      const aIn = a.qty > 0 ? 1 : 0;
      const bIn = b.qty > 0 ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      return a.name.localeCompare(b.name);
    });
  }, [snapshot.inventory, search]);

  const addInventoryToCart = (it: InventoryItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.inventoryItemId === it.id);
      if (existing) {
        return prev.map((c) => (c.inventoryItemId === it.id ? { ...c, qty: c.qty + 1 } : c));
      }
      return [
        ...prev,
        {
          key: `inv_${it.id}`,
          inventoryItemId: it.id,
          itemName: it.name,
          qty: 1,
          unitPrice: it.sellPrice,
        },
      ];
    });
  };

  const addCustomToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    const price = Math.max(0, Number(customPrice) || 0);
    setCart((prev) => [
      ...prev,
      {
        key: `cust_${Date.now()}`,
        inventoryItemId: '',
        itemName: customName.trim(),
        qty: 1,
        unitPrice: price,
      },
    ]);
    setCustomName('');
    setCustomPrice('');
  };

  const updateCartQty = (key: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((c) => (c.key === key ? { ...c, qty: c.qty + delta } : c))
        .filter((c) => c.qty > 0)
    );
  };

  const subtotal = useMemo(() => cart.reduce((s, c) => s + c.qty * c.unitPrice, 0), [cart]);
  const discountVal = Math.max(0, Number(discount) || 0);
  const total = Math.max(0, subtotal - discountVal);
  const tenderedVal = paymentMethod === 'Cash' ? Number(tendered) || total : total;
  const changeDue = paymentMethod === 'Cash' ? Math.max(0, tenderedVal - total) : 0;

  const handleCheckout = async () => {
    if (cart.length === 0 || busy) return;
    setBusy(true);
    try {
      const res = await completePosSale({
        customerName: customerName.trim() || 'Walk-in',
        customerPhone: customerPhone.trim(),
        items: cart.map((c) => ({
          inventoryItemId: c.inventoryItemId,
          itemName: c.itemName,
          qty: c.qty,
          unitPrice: c.unitPrice,
        })),
        discount: discountVal,
        paymentMethod,
        amountTendered: tenderedVal,
        staffName: snapshot.staff[0]?.name || 'Counter',
      });
      setCart([]);
      setDiscount('0');
      setTendered('');
      setCustomerName('Walk-in');
      setCustomerPhone('');
      onPrint({ type: 'pos-receipt', sale: res.sale, items: res.items });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Catalog Search & Quick Add */}
        <div className="lg:col-span-7 space-y-4">
          <div className="store-card border border-slate-200 p-4 space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search parts, SKU, barcode, or rack..."
                  className="w-full min-h-[44px] pl-10 pr-3 border border-slate-300 rounded-[10px] text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onScanBarcode((code) => {
                    const hit = snapshot.inventory.find(
                      (i) => i.barcode.toLowerCase() === code.toLowerCase() || i.sku.toLowerCase() === code.toLowerCase()
                    );
                    if (hit) addInventoryToCart(hit);
                    else setSearch(code);
                  })
                }
                className="min-h-[44px] px-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan Item</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[380px] overflow-y-auto">
              {rankedCatalog.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => addInventoryToCart(it)}
                  className="text-left p-3 border border-slate-200 hover:border-blue-600 rounded-[8px] bg-white transition-colors cursor-pointer flex flex-col justify-between gap-1"
                >
                  <div className="font-bold text-sm text-slate-900 truncate">{it.name}</div>
                  <div className="flex items-center justify-between text-xs">
                    <span className={it.qty > 0 ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                      Stock: {it.qty} · Rack {it.shelfLocation || 'N/A'}
                    </span>
                    <span className="font-mono-num font-extrabold text-slate-900">
                      {formatMoney(it.sellPrice, currency)}
                    </span>
                  </div>
                </button>
              ))}
              {rankedCatalog.length === 0 && (
                <div className="col-span-full py-6 text-center text-sm text-slate-500">
                  No inventory items found. Add a quick custom service or item below.
                </div>
              )}
            </div>

            {/* Quick Custom Service / Item */}
            <form onSubmit={addCustomToCart} className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Quick custom service / item name..."
                className="flex-1 min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
              />
              <input
                type="number"
                min={0}
                step="0.01"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                placeholder="Price"
                className="w-full sm:w-28 min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
              />
              <button
                type="submit"
                disabled={!customName.trim()}
                className="min-h-[44px] px-4 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-[8px] disabled:opacity-40 shrink-0 cursor-pointer"
              >
                + Add Line
              </button>
            </form>
          </div>
        </div>

        {/* Cart & Checkout */}
        <div className="lg:col-span-5 store-card border border-slate-200 p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-blue-700" />
              <h2 className="text-base font-bold text-slate-900">POS Counter Bill</h2>
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setCart([])}
                className="text-xs font-semibold text-red-700 hover:underline cursor-pointer"
              >
                Clear Cart
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer Name"
              className="min-h-[40px] px-3 border border-slate-300 rounded-[8px] text-xs"
            />
            <input
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone (optional)"
              className="min-h-[40px] px-3 border border-slate-300 rounded-[8px] text-xs font-mono-num"
            />
          </div>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500 border border-dashed border-slate-300 rounded-[8px]">
              Tap items on the left or scan barcode to start billing.
            </div>
          ) : (
            <div className="divide-y divide-slate-200 max-h-60 overflow-y-auto">
              {cart.map((line) => (
                <div key={line.key} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-900 truncate">{line.itemName}</div>
                    <div className="text-xs font-mono-num text-slate-500">
                      {formatMoney(line.unitPrice, currency)} each
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => updateCartQty(line.key, -1)}
                      className="min-h-[36px] min-w-[36px] border border-slate-300 rounded-[6px] flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-7 text-center font-mono-num text-sm font-bold">{line.qty}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(line.key, 1)}
                      className="min-h-[36px] min-w-[36px] border border-slate-300 rounded-[6px] flex items-center justify-center hover:bg-slate-100 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setCart((p) => p.filter((c) => c.key !== line.key))}
                      className="min-h-[36px] min-w-[36px] text-red-700 flex items-center justify-center hover:bg-red-50 rounded-[6px] cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="border-t border-slate-200 pt-3 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-600">Subtotal</span>
              <span className="font-mono-num font-bold">{formatMoney(subtotal, currency)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-600">Discount</span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-28 min-h-[38px] px-2.5 border border-slate-300 rounded-[8px] text-right font-mono-num text-sm"
              />
            </div>
            <div className="flex justify-between text-lg font-extrabold pt-2 border-t border-slate-200">
              <span>Net Total</span>
              <span className="font-mono-num text-blue-700">{formatMoney(total, currency)}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1">
              {(['Cash', 'Card', 'Online'] as PaymentMethod[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`min-h-[42px] text-xs font-bold rounded-[8px] border cursor-pointer ${
                    paymentMethod === m
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-300'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {paymentMethod === 'Cash' && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Cash Tendered</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder={total.toFixed(2)}
                    className="w-full min-h-[42px] px-3 border border-slate-300 rounded-[8px] font-mono-num text-sm"
                  />
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-[8px] px-3 py-2 flex flex-col justify-center">
                  <span className="text-[11px] font-semibold text-slate-500">Change Due</span>
                  <span className="text-base font-extrabold font-mono-num text-emerald-700">
                    {formatMoney(changeDue, currency)}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={cart.length === 0 || busy}
              onClick={() => void handleCheckout()}
              className="w-full min-h-[48px] store-primary-btn font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{busy ? 'Completing...' : 'Complete Sale & Print 58mm'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Recent POS Counter Sales */}
      <div className="store-card border border-slate-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200">
          <h3 className="text-sm font-bold text-slate-900">Recent Counter Sales ({snapshot.posSales.length})</h3>
        </div>
        {snapshot.posSales.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-500">No POS bills recorded yet.</div>
        ) : (
          <div className="divide-y divide-slate-200">
            {snapshot.posSales.slice(0, 10).map((s) => (
              <div key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-bold text-slate-900">
                    <span className="font-mono-num text-blue-700">{s.saleNo}</span> · {s.customerName || 'Walk-in'}
                  </div>
                  <div className="text-xs text-slate-500">
                    {new Date(s.createdAtMs).toLocaleString()} · {s.paymentMethod}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-mono-num font-extrabold text-sm text-slate-900">
                    {formatMoney(s.totalAmount, currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const items = snapshot.posSaleItems.filter((si) => si.saleId === s.id);
                      onPrint({ type: 'pos-receipt', sale: s, items });
                    }}
                    className="min-h-[38px] px-3 border border-slate-300 hover:bg-slate-50 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Receipt</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
