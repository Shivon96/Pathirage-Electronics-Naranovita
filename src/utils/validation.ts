import type {
  InventoryItem,
  PosSale,
  PosSaleItem,
  RepairTicket,
  SavedTheme,
  ShopProfile,
  StaffMember,
  TicketPart,
  TicketTimelineEntry,
  WorkshopBooking,
} from '../types';

const ID_REGEX = /^[a-zA-Z0-9_\-]+$/;

export function makeSafeId(prefix: string): string {
  const cleanPrefix = prefix.replace(/[^a-zA-Z0-9_\-]/g, '').slice(0, 16) || 'doc';
  const rand = Math.random().toString(36).slice(2, 8);
  const id = `${cleanPrefix}_${Date.now()}_${rand}`;
  return id.slice(0, 64);
}

export function assertSafeId(id: string, fallbackPrefix = 'doc'): string {
  if (id && id.length <= 128 && ID_REGEX.test(id)) {
    return id;
  }
  return makeSafeId(fallbackPrefix);
}

export function clampStr(val: string | undefined | null, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : fallback;
  if (!str && fallback) return fallback.slice(0, maxLen);
  return str.slice(0, maxLen);
}

export function clampNum(val: number | undefined | null, minVal = 0, maxVal = 99999999): number {
  const num = typeof val === 'number' && Number.isFinite(val) ? val : minVal;
  return Math.min(maxVal, Math.max(minVal, Math.round(num * 100) / 100));
}

export function sanitizeShopProfile(p: ShopProfile, ownerUid: string) {
  return {
    id: assertSafeId(p.id || 'default', 'default'),
    ownerUid,
    shopName: clampStr(p.shopName, 120, 'Store'),
    shopPhone: clampStr(p.shopPhone, 40, ''),
    shopAddress: clampStr(p.shopAddress, 240, ''),
    currencySymbol: clampStr(p.currencySymbol, 12, 'Rs.'),
    receiptFooter: clampStr(p.receiptFooter, 200, ''),
    nextTicketSeq: Math.max(1, Math.floor(clampNum(p.nextTicketSeq, 1, 999999999))),
    nextSaleSeq: Math.max(1, Math.floor(clampNum(p.nextSaleSeq, 1, 999999999))),
    nextBookingSeq: Math.max(1, Math.floor(clampNum(p.nextBookingSeq, 1, 999999999))),
    activeThemeId: clampStr(p.activeThemeId, 64, 'classic-store'),
    themePrimary: clampStr(p.themePrimary, 24, '#1D4ED8'),
    themeHeader: clampStr(p.themeHeader, 24, '#1E293B'),
    themeBackground: clampStr(p.themeBackground, 24, '#F8FAFC'),
    themeSurface: clampStr(p.themeSurface, 24, '#FFFFFF'),
    themeAccent: clampStr(p.themeAccent, 24, '#0F766E'),
    themeText: clampStr(p.themeText, 24, '#0F172A'),
    cornerRadius: clampNum(p.cornerRadius, 0, 32),
  };
}

export function sanitizeSavedTheme(t: SavedTheme, ownerUid: string) {
  return {
    id: assertSafeId(t.id, 'theme'),
    ownerUid,
    name: clampStr(t.name, 80, 'Custom Theme'),
    primary: clampStr(t.primary, 24, '#1D4ED8'),
    header: clampStr(t.header, 24, '#1E293B'),
    background: clampStr(t.background, 24, '#F8FAFC'),
    surface: clampStr(t.surface, 24, '#FFFFFF'),
    accent: clampStr(t.accent, 24, '#0F766E'),
    text: clampStr(t.text, 24, '#0F172A'),
    cornerRadius: clampNum(t.cornerRadius, 0, 32),
    isPreset: Boolean(t.isPreset),
  };
}

export function sanitizeStaffMember(s: StaffMember, ownerUid: string) {
  return {
    id: assertSafeId(s.id, 'staff'),
    ownerUid,
    name: clampStr(s.name, 100, 'Staff'),
    role: (['Admin', 'Technician', 'Cashier'].includes(s.role) ? s.role : 'Technician') as StaffMember['role'],
    phone: clampStr(s.phone, 40, ''),
    active: Boolean(s.active),
  };
}

export function sanitizeRepairTicket(t: RepairTicket, ownerUid: string) {
  return {
    id: assertSafeId(t.id, 'tkt'),
    ownerUid,
    ticketNo: clampStr(t.ticketNo, 40, 'T-1001'),
    deviceBarcode: clampStr(t.deviceBarcode, 80, 'DEV-0001'),
    customerName: clampStr(t.customerName, 120, 'Walk-in Customer'),
    customerPhone: clampStr(t.customerPhone, 40, ''),
    deviceType: clampStr(t.deviceType, 80, 'Electronics'),
    deviceBrand: clampStr(t.deviceBrand, 80, ''),
    deviceModel: clampStr(t.deviceModel, 100, ''),
    serialNo: clampStr(t.serialNo, 100, ''),
    faultDescription: clampStr(t.faultDescription, 1000, 'General checkup'),
    diagnosisNotes: clampStr(t.diagnosisNotes, 1000, ''),
    status: (['Received', 'Diagnosing', 'Ready for Pickup', 'Delivered'].includes(t.status)
      ? t.status
      : 'Received') as RepairTicket['status'],
    assignedStaff: clampStr(t.assignedStaff, 100, ''),
    laborCharge: clampNum(t.laborCharge, 0),
    partsTotal: clampNum(t.partsTotal, 0),
    discount: clampNum(t.discount, 0),
    totalAmount: clampNum(t.totalAmount, 0),
    advanceDeposit: clampNum(t.advanceDeposit, 0),
    depositMethod: (['Cash', 'Card', 'Online', 'None'].includes(t.depositMethod)
      ? t.depositMethod
      : 'None') as RepairTicket['depositMethod'],
    depositPaidAtMs: Math.floor(clampNum(t.depositPaidAtMs, 0, 9999999999999)),
    settledAmount: clampNum(t.settledAmount, 0),
    settlementMethod: (['Cash', 'Card', 'Online', 'None'].includes(t.settlementMethod)
      ? t.settlementMethod
      : 'None') as RepairTicket['settlementMethod'],
    settledAtMs: Math.floor(clampNum(t.settledAtMs, 0, 9999999999999)),
    balanceDue: clampNum(t.balanceDue, 0),
    createdAtMs: Math.floor(clampNum(t.createdAtMs, 0, 9999999999999)),
    updatedAtMs: Math.floor(clampNum(t.updatedAtMs, 0, 9999999999999)),
  };
}

export function sanitizeTicketPart(p: TicketPart, ownerUid: string) {
  return {
    id: assertSafeId(p.id, 'tpart'),
    ownerUid,
    ticketId: assertSafeId(p.ticketId, 'tkt'),
    inventoryItemId: clampStr(p.inventoryItemId, 64, ''),
    itemName: clampStr(p.itemName, 140, 'Spare Part'),
    shelfLocation: clampStr(p.shelfLocation, 60, ''),
    qty: clampNum(p.qty, 0.001, 999999),
    unitPrice: clampNum(p.unitPrice, 0),
    lineTotal: clampNum(p.lineTotal, 0),
    addedAtMs: Math.floor(clampNum(p.addedAtMs, 0, 9999999999999)),
  };
}

export function sanitizeTicketTimeline(e: TicketTimelineEntry, ownerUid: string) {
  return {
    id: assertSafeId(e.id, 'tl'),
    ownerUid,
    ticketId: assertSafeId(e.ticketId, 'tkt'),
    eventType: clampStr(e.eventType, 40, 'UPDATE'),
    summary: clampStr(e.summary, 400, 'Ticket updated'),
    actor: clampStr(e.actor, 100, 'Staff'),
    createdAtMs: Math.floor(clampNum(e.createdAtMs, 0, 9999999999999)),
  };
}

export function sanitizeInventoryItem(i: InventoryItem, ownerUid: string) {
  return {
    id: assertSafeId(i.id, 'inv'),
    ownerUid,
    name: clampStr(i.name, 140, 'Unnamed Part'),
    sku: clampStr(i.sku, 60, ''),
    barcode: clampStr(i.barcode, 80, ''),
    category: clampStr(i.category, 60, 'General'),
    shelfLocation: clampStr(i.shelfLocation, 60, ''),
    qty: clampNum(i.qty, 0, 9999999),
    minQty: clampNum(i.minQty, 0, 9999999),
    costPrice: clampNum(i.costPrice, 0),
    sellPrice: clampNum(i.sellPrice, 0),
    unit: clampStr(i.unit, 24, 'pcs'),
    stockInTotal: clampNum(i.stockInTotal, 0, 99999999),
    stockOutTotal: clampNum(i.stockOutTotal, 0, 99999999),
    updatedAtMs: Math.floor(clampNum(i.updatedAtMs, 0, 9999999999999)),
  };
}

export function sanitizePosSale(s: PosSale, ownerUid: string) {
  return {
    id: assertSafeId(s.id, 'sale'),
    ownerUid,
    saleNo: clampStr(s.saleNo, 40, 'POS-5001'),
    customerName: clampStr(s.customerName, 120, 'Walk-in'),
    customerPhone: clampStr(s.customerPhone, 40, ''),
    subtotal: clampNum(s.subtotal, 0),
    discount: clampNum(s.discount, 0),
    totalAmount: clampNum(s.totalAmount, 0),
    paymentMethod: (['Cash', 'Card', 'Online'].includes(s.paymentMethod)
      ? s.paymentMethod
      : 'Cash') as PosSale['paymentMethod'],
    amountTendered: clampNum(s.amountTendered, 0),
    changeDue: clampNum(s.changeDue, 0),
    staffName: clampStr(s.staffName, 100, ''),
    createdAtMs: Math.floor(clampNum(s.createdAtMs, 0, 9999999999999)),
  };
}

export function sanitizePosSaleItem(si: PosSaleItem, ownerUid: string) {
  return {
    id: assertSafeId(si.id, 'sitem'),
    ownerUid,
    saleId: assertSafeId(si.saleId, 'sale'),
    inventoryItemId: clampStr(si.inventoryItemId, 64, ''),
    itemName: clampStr(si.itemName, 140, 'Item'),
    qty: clampNum(si.qty, 0.001, 999999),
    unitPrice: clampNum(si.unitPrice, 0),
    lineTotal: clampNum(si.lineTotal, 0),
  };
}

export function sanitizeWorkshopBooking(b: WorkshopBooking, ownerUid: string) {
  return {
    id: assertSafeId(b.id, 'bkg'),
    ownerUid,
    bookingNo: clampStr(b.bookingNo, 40, 'BK-201'),
    customerName: clampStr(b.customerName, 120, 'Customer'),
    customerPhone: clampStr(b.customerPhone, 40, ''),
    deviceType: clampStr(b.deviceType, 80, 'Device'),
    deviceModel: clampStr(b.deviceModel, 100, ''),
    deviceBarcode: clampStr(b.deviceBarcode, 80, ''),
    issueSummary: clampStr(b.issueSummary, 500, 'Inspection'),
    scheduledDate: clampStr(b.scheduledDate, 32, new Date().toISOString().slice(0, 10)),
    status: (['Scheduled', 'Checked In', 'Cancelled'].includes(b.status)
      ? b.status
      : 'Scheduled') as WorkshopBooking['status'],
    convertedTicketId: clampStr(b.convertedTicketId, 64, ''),
    createdAtMs: Math.floor(clampNum(b.createdAtMs, 0, 9999999999999)),
    updatedAtMs: Math.floor(clampNum(b.updatedAtMs, 0, 9999999999999)),
  };
}

export function formatMoney(amount: number, currency = 'Rs.'): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${currency} ${safe.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function multiTokenMatch(haystack: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const h = haystack.toLowerCase();
  const tokens = q.split(/\s+/).filter(Boolean);
  return tokens.every((tok) => h.includes(tok));
}
