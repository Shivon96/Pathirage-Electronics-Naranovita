import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  CheckCircle2,
  Clock,
  History,
  Plus,
  Printer,
  QrCode,
  Search,
  Trash2,
  Wrench,
} from 'lucide-react';
import { useStore } from '../context/StoreContext';
import type { PaymentMethod, PrintJob, RepairTicket, TicketStatus } from '../types';
import { formatMoney, multiTokenMatch } from '../utils/validation';

interface TicketsPageProps {
  selectedTicketId: string | null;
  onSelectTicketId: (id: string | null) => void;
  externalSearch: string;
  onExternalSearchChange: (val: string) => void;
  openCreateSignal: number;
  onPrint: (job: PrintJob) => void;
  onScanBarcode: (callback: (code: string) => void) => void;
}

const STATUSES: TicketStatus[] = ['Received', 'Diagnosing', 'Ready for Pickup', 'Delivered'];

export const TicketsPage: React.FC<TicketsPageProps> = ({
  selectedTicketId,
  onSelectTicketId,
  externalSearch,
  onExternalSearchChange,
  openCreateSignal,
  onPrint,
  onScanBarcode,
}) => {
  const {
    snapshot,
    createTicket,
    updateTicket,
    settleTicketBalance,
    attachPartToTicket,
    removePartFromTicket,
    createBooking,
    updateBookingStatus,
    convertBookingToTicket,
  } = useStore();
  const currency = snapshot.shopProfile.currencySymbol || 'Rs.';

  const [tab, setTab] = useState<'tickets' | 'bookings'>('tickets');
  const [statusFilter, setStatusFilter] = useState<'All' | TicketStatus>('All');

  // New Ticket Modal
  const [newOpen, setNewOpen] = useState(false);
  const [lastSignal, setLastSignal] = useState(openCreateSignal);
  const [deviceBarcode, setDeviceBarcode] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [deviceType, setDeviceType] = useState('Laptop');
  const [deviceBrand, setDeviceBrand] = useState('');
  const [deviceModel, setDeviceModel] = useState('');
  const [serialNo, setSerialNo] = useState('');
  const [faultDescription, setFaultDescription] = useState('');
  const [assignedStaff, setAssignedStaff] = useState('');
  const [laborCharge, setLaborCharge] = useState('0');
  const [advanceDeposit, setAdvanceDeposit] = useState('0');
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>('Cash');

  // New Booking Modal
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bkName, setBkName] = useState('');
  const [bkPhone, setBkPhone] = useState('');
  const [bkType, setBkType] = useState('TV / Monitor');
  const [bkModel, setBkModel] = useState('');
  const [bkBarcode, setBkBarcode] = useState('');
  const [bkIssue, setBkIssue] = useState('');
  const [bkDate, setBkDate] = useState(new Date().toISOString().slice(0, 10));

  // Ticket Detail Part Search & Settlement
  const [partSearch, setPartSearch] = useState('');
  const [customPartName, setCustomPartName] = useState('');
  const [customPartPrice, setCustomPartPrice] = useState('');
  const [settleMethod, setSettleMethod] = useState<PaymentMethod>('Cash');
  const [settleAmount, setSettleAmount] = useState('');
  const [editLabor, setEditLabor] = useState('');
  const [editDiscount, setEditDiscount] = useState('');
  const [editDiag, setEditDiag] = useState('');

  if (openCreateSignal !== lastSignal) {
    setLastSignal(openCreateSignal);
    if (openCreateSignal > 0 && !newOpen) {
      setDeviceBarcode('');
      setCustomerName('');
      setCustomerPhone('');
      setDeviceType('Electronics');
      setDeviceBrand('');
      setDeviceModel('');
      setSerialNo('');
      setFaultDescription('');
      setLaborCharge('0');
      setAdvanceDeposit('0');
      setNewOpen(true);
    }
  }

  const selectedTicket = useMemo(
    () => snapshot.tickets.find((t) => t.id === selectedTicketId) || null,
    [snapshot.tickets, selectedTicketId]
  );

  // Sync detail editable inputs when ticket selection changes
  React.useEffect(() => {
    if (selectedTicket) {
      setEditLabor(String(selectedTicket.laborCharge));
      setEditDiscount(String(selectedTicket.discount));
      setEditDiag(selectedTicket.diagnosisNotes || '');
      setSettleAmount(String(selectedTicket.balanceDue));
    }
  }, [selectedTicket]);

  // Barcode history matches when externalSearch matches a deviceBarcode
  const barcodeHistoryTickets = useMemo(() => {
    const q = externalSearch.trim().toLowerCase();
    if (!q) return [];
    const exactOrMatchingBarcode = snapshot.tickets.filter(
      (t) => t.deviceBarcode.toLowerCase() === q
    );
    if (exactOrMatchingBarcode.length > 0) return exactOrMatchingBarcode;
    return [];
  }, [snapshot.tickets, externalSearch]);

  const filteredTickets = useMemo(() => {
    return snapshot.tickets.filter((t) => {
      if (statusFilter !== 'All' && t.status !== statusFilter) return false;
      const hay = `${t.ticketNo} ${t.deviceBarcode} ${t.customerName} ${t.customerPhone} ${t.deviceType} ${t.deviceBrand} ${t.deviceModel} ${t.faultDescription}`;
      return multiTokenMatch(hay, externalSearch);
    });
  }, [snapshot.tickets, statusFilter, externalSearch]);

  // Quick spare-part search ranked in-stock first
  const rankedParts = useMemo(() => {
    const matches = snapshot.inventory.filter((it) =>
      multiTokenMatch(`${it.name} ${it.sku} ${it.barcode} ${it.shelfLocation}`, partSearch)
    );
    return matches.sort((a, b) => {
      const aIn = a.qty > 0 ? 1 : 0;
      const bIn = b.qty > 0 ? 1 : 0;
      if (aIn !== bIn) return bIn - aIn;
      return a.name.localeCompare(b.name);
    });
  }, [snapshot.inventory, partSearch]);

  const openNewJobForDevice = (source: RepairTicket) => {
    setDeviceBarcode(source.deviceBarcode);
    setCustomerName(source.customerName);
    setCustomerPhone(source.customerPhone);
    setDeviceType(source.deviceType);
    setDeviceBrand(source.deviceBrand);
    setDeviceModel(source.deviceModel);
    setSerialNo(source.serialNo);
    setFaultDescription('');
    setLaborCharge('0');
    setAdvanceDeposit('0');
    setNewOpen(true);
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !faultDescription.trim()) return;
    const created = await createTicket({
      deviceBarcode: deviceBarcode.trim() || undefined,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      deviceType: deviceType.trim() || 'Electronics',
      deviceBrand: deviceBrand.trim(),
      deviceModel: deviceModel.trim(),
      serialNo: serialNo.trim(),
      faultDescription: faultDescription.trim(),
      assignedStaff: assignedStaff.trim(),
      laborCharge: Number(laborCharge) || 0,
      advanceDeposit: Number(advanceDeposit) || 0,
      depositMethod: (Number(advanceDeposit) || 0) > 0 ? depositMethod : 'None',
    });
    setNewOpen(false);
    onSelectTicketId(created.id);
    setTab('tickets');
  };

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bkName.trim() || !bkIssue.trim()) return;
    await createBooking({
      customerName: bkName.trim(),
      customerPhone: bkPhone.trim(),
      deviceType: bkType.trim() || 'Electronics',
      deviceModel: bkModel.trim(),
      deviceBarcode: bkBarcode.trim(),
      issueSummary: bkIssue.trim(),
      scheduledDate: bkDate,
    });
    setBookingOpen(false);
    setBkName('');
    setBkPhone('');
    setBkModel('');
    setBkBarcode('');
    setBkIssue('');
  };

  // Ticket detail sub-lists
  const ticketParts = useMemo(
    () => (selectedTicket ? snapshot.ticketParts.filter((p) => p.ticketId === selectedTicket.id) : []),
    [snapshot.ticketParts, selectedTicket]
  );

  const ticketTimeline = useMemo(
    () => (selectedTicket ? snapshot.ticketTimeline.filter((tl) => tl.ticketId === selectedTicket.id) : []),
    [snapshot.ticketTimeline, selectedTicket]
  );

  const deviceVisitHistory = useMemo(() => {
    if (!selectedTicket) return [];
    return snapshot.tickets.filter(
      (t) => t.deviceBarcode.toLowerCase() === selectedTicket.deviceBarcode.toLowerCase()
    );
  }, [snapshot.tickets, selectedTicket]);

  return (
    <div className="space-y-4">
      {/* Top Bar */}
      <div className="store-card border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-[10px]">
            <button
              type="button"
              onClick={() => setTab('tickets')}
              className={`min-h-[40px] px-4 text-xs sm:text-sm font-semibold rounded-[8px] cursor-pointer ${
                tab === 'tickets' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Repair Tickets ({snapshot.tickets.length})
            </button>
            <button
              type="button"
              onClick={() => setTab('bookings')}
              className={`min-h-[40px] px-4 text-xs sm:text-sm font-semibold rounded-[8px] cursor-pointer ${
                tab === 'bookings' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              Bookings ({snapshot.bookings.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {tab === 'bookings' ? (
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="min-h-[44px] px-4 store-primary-btn text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Booking</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setDeviceBarcode('');
                  setCustomerName('');
                  setCustomerPhone('');
                  setDeviceType('Electronics');
                  setDeviceBrand('');
                  setDeviceModel('');
                  setSerialNo('');
                  setFaultDescription('');
                  setLaborCharge('0');
                  setAdvanceDeposit('0');
                  setNewOpen(true);
                }}
                className="min-h-[44px] px-4 store-primary-btn text-sm font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>New Repair</span>
              </button>
            )}
          </div>
        </div>

        {tab === 'tickets' && (
          <>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={externalSearch}
                  onChange={(e) => onExternalSearchChange(e.target.value)}
                  placeholder="Search device barcode, ticket #, customer, phone..."
                  className="w-full min-h-[44px] pl-10 pr-3 border border-slate-300 rounded-[10px] text-sm"
                />
              </div>
              <button
                type="button"
                onClick={() =>
                  onScanBarcode((code) => {
                    onExternalSearchChange(code);
                    onSelectTicketId(null);
                  })
                }
                className="min-h-[44px] px-4 border border-slate-300 bg-white hover:bg-slate-50 rounded-[10px] text-sm font-semibold flex items-center justify-center gap-2 shrink-0 cursor-pointer"
              >
                <QrCode className="w-4 h-4" />
                <span>Scan Device Code</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['All', ...STATUSES] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`min-h-[36px] px-3 text-xs font-semibold rounded-[8px] border cursor-pointer ${
                    statusFilter === st
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Barcode History Banner when scanned/searched barcode matches existing jobs */}
      {tab === 'tickets' && barcodeHistoryTickets.length > 0 && (
        <div className="store-card border border-blue-300 bg-blue-50/70 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <History className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Device History Found for Barcode{' '}
                <span className="font-mono-num text-blue-800">{barcodeHistoryTickets[0].deviceBarcode}</span>
              </h3>
              <p className="text-xs text-slate-700 mt-0.5">
                {barcodeHistoryTickets.length} past repair job(s) recorded. Past jobs, parts, and pricing remain preserved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => openNewJobForDevice(barcodeHistoryTickets[0])}
            className="min-h-[44px] px-4 store-primary-btn text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            + New Job for This Device
          </button>
        </div>
      )}

      {tab === 'bookings' ? (
        <div className="store-card border border-slate-200 divide-y divide-slate-200">
          {snapshot.bookings.length === 0 ? (
            <div className="p-8 text-center">
              <CalendarClock className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600 mb-3">No repair bookings scheduled.</p>
              <button
                type="button"
                onClick={() => setBookingOpen(true)}
                className="min-h-[44px] px-4 store-primary-btn text-sm font-semibold cursor-pointer"
              >
                Schedule First Booking
              </button>
            </div>
          ) : (
            snapshot.bookings.map((bk) => (
              <div key={bk.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className="font-mono-num text-blue-700">{bk.bookingNo}</span>
                    <span aria-hidden="true">·</span>
                    <span>{bk.customerName}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-xs font-mono-num text-slate-500">{bk.scheduledDate}</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {bk.deviceType} {bk.deviceModel} · {bk.issueSummary}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <span className="text-xs font-bold text-slate-700">{bk.status}</span>
                  {bk.status === 'Scheduled' && (
                    <>
                      <button
                        type="button"
                        onClick={async () => {
                          const t = await convertBookingToTicket(bk.id);
                          if (t) {
                            setTab('tickets');
                            onSelectTicketId(t.id);
                          }
                        }}
                        className="min-h-[40px] px-3 store-primary-btn text-xs font-semibold cursor-pointer"
                      >
                        Check In to Ticket
                      </button>
                      <button
                        type="button"
                        onClick={() => void updateBookingStatus(bk.id, 'Cancelled')}
                        className="min-h-[40px] px-3 border border-slate-300 rounded-[8px] text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        /* Split Layout on Desktop: Ticket List + Detail Inspector */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
          <div className={`${selectedTicket ? 'hidden lg:block lg:col-span-5' : 'lg:col-span-12'} store-card border border-slate-200 overflow-hidden`}>
            {filteredTickets.length === 0 ? (
              <div className="p-8 text-center">
                <Wrench className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 mb-3">No repair tickets found.</p>
                <button
                  type="button"
                  onClick={() => setNewOpen(true)}
                  className="min-h-[44px] px-4 store-primary-btn text-sm font-semibold cursor-pointer"
                >
                  Create Repair Ticket
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {filteredTickets.map((t) => {
                  const active = t.id === selectedTicketId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onSelectTicketId(t.id)}
                      className={`w-full text-left p-4 hover:bg-slate-50 transition-colors cursor-pointer ${
                        active ? 'bg-blue-50/70' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-sm text-slate-900 truncate">
                          <span className="font-mono-num text-blue-700">{t.ticketNo}</span> · {t.customerName}
                        </div>
                        <span
                          className={`text-xs font-bold shrink-0 ${
                            t.status === 'Delivered'
                              ? 'text-slate-500'
                              : t.status === 'Ready for Pickup'
                              ? 'text-emerald-700'
                              : t.status === 'Diagnosing'
                              ? 'text-amber-700'
                              : 'text-blue-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-600 mt-1 truncate">
                        {t.deviceType} {t.deviceBrand} {t.deviceModel} · Code{' '}
                        <span className="font-mono-num font-semibold">{t.deviceBarcode}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-500 mt-1.5">
                        <span>{new Date(t.createdAtMs).toLocaleDateString()}</span>
                        <span className="font-mono-num font-bold text-slate-900">
                          Total {formatMoney(t.totalAmount, currency)} · Bal {formatMoney(t.balanceDue, currency)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Detail Inspector */}
          {selectedTicket && (
            <div className="lg:col-span-7 store-card border border-slate-200 p-4 sm:p-5 space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-slate-200">
                <div>
                  <button
                    type="button"
                    onClick={() => onSelectTicketId(null)}
                    className="lg:hidden text-xs font-semibold text-blue-700 mb-2 cursor-pointer"
                  >
                    ← Back to Tickets
                  </button>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-extrabold font-mono-num text-slate-900">
                      {selectedTicket.ticketNo}
                    </h3>
                    <span className="text-sm font-bold text-slate-700">· {selectedTicket.customerName}</span>
                    {selectedTicket.customerPhone && (
                      <span className="text-xs font-mono-num text-slate-500">· {selectedTicket.customerPhone}</span>
                    )}
                  </div>
                  <div className="text-xs text-slate-600 mt-1">
                    {selectedTicket.deviceType} {selectedTicket.deviceBrand} {selectedTicket.deviceModel} · Barcode{' '}
                    <span className="font-mono-num font-bold text-slate-900">{selectedTicket.deviceBarcode}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onPrint({ type: 'intake-sticker', ticket: selectedTicket })}
                    className="min-h-[40px] px-3 border border-slate-300 bg-white hover:bg-slate-50 rounded-[8px] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>58×50 Sticker</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onPrint({ type: 'ticket-receipt', ticket: selectedTicket, parts: ticketParts })}
                    className="min-h-[40px] px-3 store-primary-btn text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>58mm Receipt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openNewJobForDevice(selectedTicket)}
                    className="min-h-[40px] px-3 border border-blue-600 text-blue-700 hover:bg-blue-50 rounded-[8px] text-xs font-semibold cursor-pointer"
                  >
                    + Repeat Job
                  </button>
                </div>
              </div>

              {/* Same-Device Visit History Switcher */}
              {deviceVisitHistory.length > 1 && (
                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-blue-700" />
                    <span>
                      All {deviceVisitHistory.length} Independent Visits for Barcode {selectedTicket.deviceBarcode}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {deviceVisitHistory.map((hv) => (
                      <button
                        key={hv.id}
                        type="button"
                        onClick={() => onSelectTicketId(hv.id)}
                        className={`min-h-[34px] px-2.5 text-xs font-mono-num font-semibold rounded-[6px] border cursor-pointer ${
                          hv.id === selectedTicket.id
                            ? 'bg-blue-700 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {hv.ticketNo} ({new Date(hv.createdAtMs).toLocaleDateString()})
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status Workflow */}
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-2">Repair Status</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {STATUSES.map((st) => {
                    const active = selectedTicket.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() =>
                          void updateTicket(
                            selectedTicket.id,
                            { status: st },
                            `Status changed to ${st}`,
                            'STATUS'
                          )
                        }
                        className={`min-h-[44px] px-2.5 text-xs font-bold rounded-[8px] border transition-colors cursor-pointer ${
                          active
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Fault & Diagnosis */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Reported Fault</label>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-[8px] text-sm text-slate-800">
                    {selectedTicket.faultDescription}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Technician Diagnosis Notes</label>
                  <div className="flex gap-2">
                    <textarea
                      rows={2}
                      value={editDiag}
                      onChange={(e) => setEditDiag(e.target.value)}
                      placeholder="Diagnosis & repair notes..."
                      className="flex-1 p-2.5 border border-slate-300 rounded-[8px] text-sm"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        void updateTicket(
                          selectedTicket.id,
                          { diagnosisNotes: editDiag },
                          'Updated diagnosis notes',
                          'NOTE'
                        )
                      }
                      className="min-h-[44px] px-3 border border-slate-300 hover:bg-slate-50 rounded-[8px] text-xs font-semibold cursor-pointer self-start"
                    >
                      Save
                    </button>
                  </div>
                </div>
              </div>

              {/* Spare Parts Attached + Quick Search Attach */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-slate-900">Spare Parts Used</h4>
                  <span className="text-sm font-mono-num font-bold text-slate-900">
                    {formatMoney(selectedTicket.partsTotal, currency)}
                  </span>
                </div>

                {ticketParts.length > 0 && (
                  <div className="border border-slate-200 rounded-[8px] divide-y divide-slate-200">
                    {ticketParts.map((tp) => (
                      <div key={tp.id} className="px-3 py-2 flex items-center justify-between gap-2 text-sm">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 truncate">{tp.itemName}</div>
                          <div className="text-xs text-slate-500">
                            {tp.qty} × {formatMoney(tp.unitPrice, currency)}
                            {tp.shelfLocation ? ` · Rack ${tp.shelfLocation}` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono-num font-bold">{formatMoney(tp.lineTotal, currency)}</span>
                          <button
                            type="button"
                            onClick={() => void removePartFromTicket(tp.id)}
                            className="min-h-[36px] min-w-[36px] flex items-center justify-center text-red-700 hover:bg-red-50 rounded-[6px] cursor-pointer"
                            title="Remove part & restore stock"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quick Inventory Search */}
                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-3 space-y-2.5">
                  <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={partSearch}
                      onChange={(e) => setPartSearch(e.target.value)}
                      placeholder="Quick attach part from stock (multi-word search, in-stock first)..."
                      className="w-full min-h-[42px] pl-9 pr-3 bg-white border border-slate-300 rounded-[8px] text-sm"
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-200 bg-white border border-slate-200 rounded-[8px]">
                    {rankedParts.slice(0, 8).map((inv) => (
                      <div key={inv.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{inv.name}</div>
                          <div className="text-slate-500">
                            Rack {inv.shelfLocation || 'N/A'} ·{' '}
                            <span className={inv.qty > 0 ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                              Stock: {inv.qty}
                            </span>{' '}
                            · {formatMoney(inv.sellPrice, currency)}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={inv.qty <= 0}
                          onClick={() =>
                            void attachPartToTicket(
                              selectedTicket.id,
                              inv.id,
                              inv.name,
                              inv.shelfLocation,
                              1,
                              inv.sellPrice
                            )
                          }
                          className="min-h-[36px] px-3 store-primary-btn text-xs font-semibold disabled:opacity-40 shrink-0 cursor-pointer"
                        >
                          + Attach
                        </button>
                      </div>
                    ))}
                    {rankedParts.length === 0 && (
                      <div className="p-3 text-xs text-slate-500 text-center">No matching inventory parts.</div>
                    )}
                  </div>

                  {/* Custom Part Entry */}
                  <div className="flex flex-col sm:flex-row gap-2 pt-1">
                    <input
                      type="text"
                      value={customPartName}
                      onChange={(e) => setCustomPartName(e.target.value)}
                      placeholder="Custom part / outsourced item"
                      className="flex-1 min-h-[40px] px-3 bg-white border border-slate-300 rounded-[8px] text-xs"
                    />
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={customPartPrice}
                      onChange={(e) => setCustomPartPrice(e.target.value)}
                      placeholder="Price"
                      className="w-full sm:w-28 min-h-[40px] px-3 bg-white border border-slate-300 rounded-[8px] text-xs font-mono-num"
                    />
                    <button
                      type="button"
                      disabled={!customPartName.trim()}
                      onClick={async () => {
                        await attachPartToTicket(
                          selectedTicket.id,
                          '',
                          customPartName.trim(),
                          '',
                          1,
                          Number(customPartPrice) || 0
                        );
                        setCustomPartName('');
                        setCustomPartPrice('');
                      }}
                      className="min-h-[40px] px-3 bg-slate-800 text-white text-xs font-semibold rounded-[8px] disabled:opacity-40 shrink-0 cursor-pointer"
                    >
                      Add Custom
                    </button>
                  </div>
                </div>
              </div>

              {/* Charges & POS Balance Settlement */}
              <div className="border-t border-slate-200 pt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Labor Charge</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editLabor}
                      onChange={(e) => setEditLabor(e.target.value)}
                      className="w-full min-h-[42px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Discount</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={editDiscount}
                      onChange={(e) => setEditDiscount(e.target.value)}
                      className="w-full min-h-[42px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        void updateTicket(
                          selectedTicket.id,
                          {
                            laborCharge: Number(editLabor) || 0,
                            discount: Number(editDiscount) || 0,
                          },
                          `Updated labor (${editLabor}) & discount (${editDiscount})`,
                          'PRICING'
                        )
                      }
                      className="w-full min-h-[42px] px-3 border border-slate-300 hover:bg-slate-50 rounded-[8px] text-xs font-bold cursor-pointer"
                    >
                      Apply Charges
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-[10px] p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Parts + Labor - Discount</span>
                    <span className="font-mono-num font-bold">{formatMoney(selectedTicket.totalAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Advance Deposit ({selectedTicket.depositMethod})</span>
                    <span className="font-mono-num">-{formatMoney(selectedTicket.advanceDeposit, currency)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span>Settled Amount ({selectedTicket.settlementMethod})</span>
                    <span className="font-mono-num">-{formatMoney(selectedTicket.settledAmount, currency)}</span>
                  </div>
                  <div className="flex justify-between text-base font-extrabold pt-2 border-t border-slate-200">
                    <span>Balance Due</span>
                    <span className={`font-mono-num ${selectedTicket.balanceDue > 0 ? 'text-blue-700' : 'text-emerald-700'}`}>
                      {formatMoney(selectedTicket.balanceDue, currency)}
                    </span>
                  </div>

                  {selectedTicket.balanceDue > 0 && (
                    <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row gap-2">
                      <select
                        value={settleMethod}
                        onChange={(e) => setSettleMethod(e.target.value as PaymentMethod)}
                        className="min-h-[44px] px-3 bg-white border border-slate-300 rounded-[8px] text-sm font-semibold"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="Online">Online</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={settleAmount}
                        onChange={(e) => setSettleAmount(e.target.value)}
                        className="flex-1 min-h-[44px] px-3 bg-white border border-slate-300 rounded-[8px] text-sm font-mono-num"
                      />
                      <button
                        type="button"
                        onClick={() => void settleTicketBalance(selectedTicket.id, Number(settleAmount) || 0, settleMethod)}
                        className="min-h-[44px] px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-[8px] text-sm font-semibold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Settle Balance</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Timeline */}
              <div className="border-t border-slate-200 pt-4">
                <h4 className="text-xs font-bold text-slate-600 mb-2 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Ticket Activity Timeline</span>
                </h4>
                <div className="space-y-1.5 max-h-40 overflow-y-auto text-xs">
                  {ticketTimeline.map((tl) => (
                    <div key={tl.id} className="flex items-start justify-between gap-2 text-slate-600">
                      <span>{tl.summary}</span>
                      <span className="font-mono-num text-[11px] text-slate-400 shrink-0">
                        {new Date(tl.createdAtMs).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* New Repair Ticket Modal */}
      {newOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleCreateTicket}
            className="w-full max-w-lg bg-white rounded-[10px] border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-base font-bold">New Repair Ticket</h3>
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="text-xs text-slate-300 hover:text-white px-2 py-1 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Device Barcode / Tag (leave empty to auto-assign)
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={deviceBarcode}
                    onChange={(e) => setDeviceBarcode(e.target.value)}
                    placeholder="Scan existing device barcode or leave blank"
                    className="flex-1 min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onScanBarcode((code) => {
                        setDeviceBarcode(code);
                        const match = snapshot.tickets.find(
                          (t) => t.deviceBarcode.toLowerCase() === code.toLowerCase()
                        );
                        if (match) {
                          setCustomerName(match.customerName);
                          setCustomerPhone(match.customerPhone);
                          setDeviceType(match.deviceType);
                          setDeviceBrand(match.deviceBrand);
                          setDeviceModel(match.deviceModel);
                          setSerialNo(match.serialNo);
                        }
                      })
                    }
                    className="min-h-[44px] px-3 border border-slate-300 rounded-[8px] hover:bg-slate-50 cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Device Type *</label>
                  <input
                    type="text"
                    required
                    value={deviceType}
                    onChange={(e) => setDeviceType(e.target.value)}
                    placeholder="Laptop / TV / Grinder"
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={deviceBrand}
                    onChange={(e) => setDeviceBrand(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={deviceModel}
                    onChange={(e) => setDeviceModel(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Fault Description *</label>
                <textarea
                  rows={2}
                  required
                  value={faultDescription}
                  onChange={(e) => setFaultDescription(e.target.value)}
                  placeholder="Describe problem, accessories included..."
                  className="w-full p-3 border border-slate-300 rounded-[8px] text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Estimated Labor</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={laborCharge}
                    onChange={(e) => setLaborCharge(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Advance Deposit</label>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={advanceDeposit}
                    onChange={(e) => setAdvanceDeposit(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deposit Method</label>
                  <select
                    value={depositMethod}
                    onChange={(e) => setDepositMethod(e.target.value as PaymentMethod)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm bg-white"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>

              {snapshot.staff.length > 0 && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Assign Technician</label>
                  <select
                    value={assignedStaff}
                    onChange={(e) => setAssignedStaff(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm bg-white"
                  >
                    <option value="">Unassigned</option>
                    {snapshot.staff
                      .filter((s) => s.active)
                      .map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name} ({s.role})
                        </option>
                      ))}
                  </select>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setNewOpen(false)}
                className="flex-1 min-h-[48px] border border-slate-300 bg-white rounded-[10px] font-semibold text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 min-h-[48px] store-primary-btn font-semibold text-sm cursor-pointer"
              >
                Create Ticket
              </button>
            </div>
          </form>
        </div>
      )}

      {/* New Booking Modal */}
      {bookingOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleCreateBooking}
            className="w-full max-w-md bg-white rounded-[10px] border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="bg-[#1E293B] text-white px-4 py-3 flex items-center justify-between">
              <h3 className="text-base font-bold">New Workshop Booking</h3>
              <button
                type="button"
                onClick={() => setBookingOpen(false)}
                className="text-xs text-slate-300 hover:text-white px-2 py-1 cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={bkName}
                  onChange={(e) => setBkName(e.target.value)}
                  className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                  <input
                    type="tel"
                    value={bkPhone}
                    onChange={(e) => setBkPhone(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Scheduled Date</label>
                  <input
                    type="date"
                    value={bkDate}
                    onChange={(e) => setBkDate(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Device Type *</label>
                  <input
                    type="text"
                    required
                    value={bkType}
                    onChange={(e) => setBkType(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={bkModel}
                    onChange={(e) => setBkModel(e.target.value)}
                    className="w-full min-h-[44px] px-3 border border-slate-300 rounded-[8px] text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Issue Summary *</label>
                <textarea
                  rows={2}
                  required
                  value={bkIssue}
                  onChange={(e) => setBkIssue(e.target.value)}
                  className="w-full p-3 border border-slate-300 rounded-[8px] text-sm"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 flex gap-3 bg-slate-50">
              <button
                type="button"
                onClick={() => setBookingOpen(false)}
                className="flex-1 min-h-[44px] border border-slate-300 bg-white rounded-[10px] font-semibold text-sm cursor-pointer"
              >
                Cancel
              </button>
              <button type="submit" className="flex-1 min-h-[44px] store-primary-btn font-semibold text-sm cursor-pointer">
                Save Booking
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
