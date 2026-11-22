import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckSquare,
  Edit3,
  Layers,
  Plus,
  Printer,
  QrCode,
  Search,
  Square,
  Trash2,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { InventoryItem, PrintJob } from '../types';
import { formatMoney, multiTokenMatch } from '../utils/validation';

interface StockRacksPageProps {
  onPrint: (job: PrintJob) => void;
  onScanBarcode: (callback: (code: string) => void) => void;
}

export const StockRacksPage: React.FC<StockRacksPageProps> = ({ onPrint, onScanBarcode }) => {
  const { snapshot, upsertInventoryItem, deleteInventoryItem, bulkAssignRack } = useStore();
  const currency = snapshot.shopProfile.currencySymbol || 'Rs.';

  const [viewMode, setViewMode] = useState<'items' | 'racks'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyLowStock, setOnlyLowStock] = useState(false);

  // Bulk assign state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkRackName, setBulkRackName] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Spare Parts');
  const [shelfLocation, setShelfLocation] = useState('');
  const [qty, setQty] = useState('1');
  const [minQty, setMinQty] = useState('2');
  const [costPrice, setCostPrice] = useState('0');
  const [sellPrice, setSellPrice] = useState('0');
  const [unit, setUnit] = useState('pcs');
  const [rackBatchNotice, setRackBatchNotice] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    return snapshot.inventory.filter((it) => {
      if (onlyLowStock && it.qty > it.minQty) return false;
      const hay = `${it.name} ${it.sku} ${it.barcode} ${it.shelfLocation} ${it.category}`;
      return multiTokenMatch(hay, searchQuery);
    });
  }, [snapshot.inventory, searchQuery, onlyLowStock]);

  const rackGroups = useMemo(() => {
    const map = new Map<string, InventoryItem[]>();
    for (const it of snapshot.inventory) {
      const rack = it.shelfLocation.trim() || 'UNASSIGNED';
      const arr = map.get(rack) || [];
      arr.push(it);
      map.set(rack, arr);
    }
    return Array.from(map.entries())
      .filter(([rack, items]) => {
        if (!searchQuery.trim()) return true;
        return (
          multiTokenMatch(rack, searchQuery) ||
          items.some((it) => multiTokenMatch(`${it.name} ${it.sku}`, searchQuery))
        );
      })
      .sort(([a], [b]) => a.localeCompare(b));
  }, [snapshot.inventory, searchQuery]);

  const openNewModal = (preserveRack = '') => {
    setEditingId(undefined);
    setName('');
    setSku('');
    setBarcode('');
    setCategory('Spare Parts');
    setShelfLocation(preserveRack);
    setQty('1');
    setMinQty('2');
    setCostPrice('0');
    setSellPrice('0');
    setUnit('pcs');
    setModalOpen(true);
  };

  const openEditModal = (it: InventoryItem) => {
    setEditingId(it.id);
    setName(it.name);
    setSku(it.sku);
    setBarcode(it.barcode);
    setCategory(it.category || 'Spare Parts');
    setShelfLocation(it.shelfLocation);
    setQty(String(it.qty));
    setMinQty(String(it.minQty));
    setCostPrice(String(it.costPrice));
    setSellPrice(String(it.sellPrice));
    setUnit(it.unit || 'pcs');
    setModalOpen(true);
  };

  const saveItem = async (addAnotherSameRack: boolean) => {
    if (!name.trim()) return;
    const prevItem = editingId ? snapshot.inventory.find((i) => i.id === editingId) : undefined;
    const nextQty = Math.max(0, Number(qty) || 0);
    const delta = prevItem ? nextQty - prevItem.qty : nextQty;

    await upsertInventoryItem(
      {
        id: editingId,
        name: name.trim(),
        sku: sku.trim(),
        barcode: barcode.trim(),
        category: category.trim() || 'Spare Parts',
        shelfLocation: shelfLocation.trim(),
        qty: nextQty,
        minQty: Math.max(0, Number(minQty) || 0),
        costPrice: Math.max(0, Number(costPrice) || 0),
        sellPrice: Math.max(0, Number(sellPrice) || 0),
        unit: unit.trim() || 'pcs',
        stockInTotal: prevItem?.stockInTotal ?? 0,
        stockOutTotal: prevItem?.stockOutTotal ?? 0,
      },
      delta
    );

    if (addAnotherSameRack) {
      const keepRack = shelfLocation.trim();
      setRackBatchNotice(`Saved "${name.trim()}" to Rack ${keepRack || 'Unassigned'}. Ready for next item.`);
      setTimeout(() => setRackBatchNotice(null), 3000);
      openNewModal(keepRack);
    } else {
      setModalOpen(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const handleBulkAssign = async () => {
    if (selectedIds.length === 0 || !bulkRackName.trim()) return;
    await bulkAssignRack(selectedIds, bulkRackName.trim());
    setSelectedIds([]);
    setBulkRackName('');
    setBulkMode(false);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="store-card border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-[10px]">
            <button
              type="button"
              onClick={() => setViewMode('items')}
              className={`min-h-[40px] px-4 text-xs sm:text-sm font-semibold rounded-[8px] transition-colors cursor-pointer ${
                viewMode === 'items' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Spare Parts ({snapshot.inventory.length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('racks')}
              className={`min-h-[40px] px-4 text-xs sm:text-sm font-semibold rounded-[8px] transition-colors cursor-pointer ${
                viewMode === 'racks' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Racks ({rackGroups.length})
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'items' && (
              <button
                type="button"
                onClick={() => {
                  setBulkMode((b) => !b);
                  setSelectedIds([]);
                }}
                className={`min-h-[44px] px-3.5 text-xs font-semibold border rounded-[10px] flex items-center gap-1.5 cursor-pointer ${
                  bulkMode ? 'border-blue-700 bg-blue-50 text-blue-800' : 'border-slate-300 bg-white text-slate-700'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{bulkMode ? 'Cancel Bulk Rack' : 'Bulk Assign Rack'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => openNewModal()}
              className="min-h-[44px] px-4 store-primary-btn text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Part</span>
            </button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search part name, rack number, SKU, or barcode..."
              className="w-full min-h-[44px] pl-10 pr-3 border border-slate-300 rounded-[10px] text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => onScanBarcode((code) => setSearchQuery(code))}
            className="min-h-[44px] px-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <QrCode className="w-4 h-4" />
            <span>Scan</span>
          </button>
          {viewMode === 'items' && (
            <button
              type="button"
              onClick={() => setOnlyLowStock((v) => !v)}
              className={`min-h-[44px] px-4 border rounded-[10px] text-xs font-semibold flex items-center justify-center gap-1.5 shrink-0 cursor-pointer ${
                onlyLowStock
                  ? 'border-amber-600 bg-amber-50 text-amber-900'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              <span>Low Stock Only</span>
            </button>
          )}
        </div>

        {bulkMode && (
          <div className="bg-blue-50 border border-blue-200 rounded-[10px] p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <span className="text-xs font-bold text-blue-900">
              {selectedIds.length} selected
            </span>
            <input
              type="text"
              value={bulkRackName}
              onChange={(e) => setBulkRackName(e.target.value)}
              placeholder="Target Rack No. (e.g. A-04)"
              className="flex-1 min-h-[40px] px-3 border border-blue-300 bg-white rounded-[8px] text-sm"
            />
            <button
              type="button"
              onClick={() => void handleBulkAssign()}
              disabled={selectedIds.length === 0 || !bulkRackName.trim()}
              className="min-h-[40px] px-4 bg-blue-700 text-white text-xs font-bold rounded-[8px] disabled:opacity-50 cursor-pointer"
            >
              Assign to Rack
            </button>
          </div>
        )}
      </div>

      {/* Items List */}
      {viewMode === 'items' ? (
        <div className="store-card border border-slate-200 overflow-hidden">
          {filteredItems.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-3">No spare parts match your filter.</p>
              <button
                type="button"
                onClick={() => openNewModal()}
                className="min-h-[44px] px-4 store-primary-btn text-sm font-semibold cursor-pointer"
              >
                Add First Spare Part
              </button>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {filteredItems.map((it) => {
                const isLow = it.qty <= it.minQty;
                const checked = selectedIds.includes(it.id);
                return (
                  <div
                    key={it.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50/70"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {bulkMode && (
                        <button
                          type="button"
                          onClick={() => toggleSelect(it.id)}
                          className="min-h-[40px] min-w-[40px] flex items-center justify-center text-blue-700 cursor-pointer"
                          aria-label={`Select ${it.name}`}
                        >
                          {checked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-slate-400" />}
                        </button>
                      )}
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm sm:text-base font-bold text-slate-900">{it.name}</span>
                          {isLow && (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Low Stock
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-600 mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-bold text-slate-800">
                            Rack: {it.shelfLocation || 'Unassigned'}
                          </span>
                          {it.sku && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">SKU {it.sku}</span>
                            </>
                          )}
                          {it.barcode && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num">Code {it.barcode}</span>
                            </>
                          )}
                          <span aria-hidden="true">·</span>
                          <span>{it.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 shrink-0">
                      <div className="text-left md:text-right">
                        <div className="text-sm font-extrabold font-mono-num text-slate-900">
                          {formatMoney(it.sellPrice, currency)}
                        </div>
                        <div
                          className={`text-xs font-mono-num font-semibold ${
                            it.qty === 0 ? 'text-red-700' : isLow ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          Stock: {it.qty} {it.unit}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onPrint({ type: 'part-label', item: it })}
                          className="min-h-[40px] px-3 border border-slate-300 bg-white hover:bg-slate-100 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                          title="Print 58x50mm Part Label (Name + Rack only)"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>58×50 Label</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(it)}
                          className="min-h-[40px] min-w-[40px] border border-slate-300 bg-white hover:bg-slate-100 rounded-[8px] flex items-center justify-center cursor-pointer"
                          aria-label={`Edit ${it.name}`}
                        >
                          <Edit3 className="w-4 h-4 text-slate-700" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteInventoryItem(it.id)}
                          className="min-h-[40px] min-w-[40px] border border-slate-300 bg-white hover:bg-red-50 rounded-[8px] flex items-center justify-center cursor-pointer"
                          aria-label={`Delete ${it.name}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-700" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Racks View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rackGroups.map(([rackName, items]) => (
            <div key={rackName} className="store-card border border-slate-200 p-4 flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">RACK: {rackName}</h3>
                    <p className="text-xs text-slate-500">{items.length} spare part(s)</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPrint({ type: 'rack-label', rackName, items })}
                    className="min-h-[40px] px-3 store-primary-btn text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>Print Rack</span>
                  </button>
                </div>
                <ul className="mt-2.5 space-y-1.5 text-sm">
                  {items.map((it) => (
                    <li key={it.id} className="flex items-center justify-between gap-2 text-slate-700">
                      <span className="truncate">{it.name}</span>
                      <span className="font-mono-num text-xs font-semibold text-slate-900 shrink-0">
                        ×{it.qty}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => openNewModal(rackName === 'UNASSIGNED' ? '' : rackName)}
                className="min-h-[40px] w-full border border-slate-300 hover:bg-slate-50 rounded-[8px] text-xs font-semibold text-slate-700 cursor-pointer"
              >
                + Add Item to {rackName}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Spare Part Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg bg-white rounded-[10px] border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-base font-bold">{editingId ? 'Edit Spare Part' : 'Add Spare Part'}</h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-xs text-slate-300 hover:text-white px-2 py-1 cursor-pointer"
              >
                Close
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3">
              {rackBatchNotice && (
                <div className="p-2.5 text-xs font-semibold bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-[8px]">
                  {rackBatchNotice}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. 12V 2A Power Adapter / LCD Connector"
                  className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Rack / Shelf Number</label>
                  <input
                    type="text"
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                    placeholder="e.g. R-12 or B2"
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Barcode</label>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="flex-1 min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                    />
                    <button
                      type="button"
                      onClick={() => onScanBarcode((c) => setBarcode(c))}
                      className="min-h-[44px] px-3 border border-slate-300 rounded-[8px] hover:bg-slate-50 cursor-pointer"
                      title="Scan barcode"
                    >
                      <QrCode className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Stock Qty</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Min Alert</label>
                  <input
                    type="number"
                    min={0}
                    step="1"
                    value={minQty}
                    onChange={(e) => setMinQty(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sell Price</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={sellPrice}
                    onChange={(e) => setSellPrice(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 flex flex-col sm:flex-row gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => void saveItem(false)}
                disabled={!name.trim()}
                className="flex-1 min-h-[48px] px-4 store-primary-btn text-sm font-semibold disabled:opacity-50 cursor-pointer"
              >
                Save Part
              </button>
              {!editingId && (
                <button
                  type="button"
                  onClick={() => void saveItem(true)}
                  disabled={!name.trim()}
                  className="flex-1 min-h-[48px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-[10px] text-sm font-semibold disabled:opacity-50 cursor-pointer"
                >
                  Save &amp; Add Another to Same Rack
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
