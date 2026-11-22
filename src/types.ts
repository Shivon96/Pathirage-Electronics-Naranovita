export type TicketStatus = 'Received' | 'Diagnosing' | 'Ready for Pickup' | 'Delivered';
export type PaymentMethod = 'Cash' | 'Card' | 'Online';
export type OptionalPaymentMethod = PaymentMethod | 'None';
export type StaffRole = 'Admin' | 'Technician' | 'Cashier';
export type BookingStatus = 'Scheduled' | 'Checked In' | 'Cancelled';

export interface ShopProfile {
  id: string;
  ownerUid: string;
  shopName: string;
  shopPhone: string;
  shopAddress: string;
  currencySymbol: string;
  receiptFooter: string;
  nextTicketSeq: number;
  nextSaleSeq: number;
  nextBookingSeq: number;
  activeThemeId: string;
  themePrimary: string;
  themeHeader: string;
  themeBackground: string;
  themeSurface: string;
  themeAccent: string;
  themeText: string;
  cornerRadius: number;
}

export interface SavedTheme {
  id: string;
  ownerUid: string;
  name: string;
  primary: string;
  header: string;
  background: string;
  surface: string;
  accent: string;
  text: string;
  cornerRadius: number;
  isPreset?: boolean;
}

export interface StaffMember {
  id: string;
  ownerUid: string;
  name: string;
  role: StaffRole;
  phone: string;
  active: boolean;
}

export interface RepairTicket {
  id: string;
  ownerUid: string;
  ticketNo: string;
  deviceBarcode: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  deviceBrand: string;
  deviceModel: string;
  serialNo: string;
  faultDescription: string;
  diagnosisNotes: string;
  status: TicketStatus;
  assignedStaff: string;
  laborCharge: number;
  partsTotal: number;
  discount: number;
  totalAmount: number;
  advanceDeposit: number;
  depositMethod: OptionalPaymentMethod;
  depositPaidAtMs: number;
  settledAmount: number;
  settlementMethod: OptionalPaymentMethod;
  settledAtMs: number;
  balanceDue: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface TicketPart {
  id: string;
  ownerUid: string;
  ticketId: string;
  inventoryItemId: string;
  itemName: string;
  shelfLocation: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  addedAtMs: number;
}

export interface TicketTimelineEntry {
  id: string;
  ownerUid: string;
  ticketId: string;
  eventType: string;
  summary: string;
  actor: string;
  createdAtMs: number;
}

export interface InventoryItem {
  id: string;
  ownerUid: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  shelfLocation: string;
  qty: number;
  minQty: number;
  costPrice: number;
  sellPrice: number;
  unit: string;
  stockInTotal: number;
  stockOutTotal: number;
  updatedAtMs: number;
}

export interface PosSale {
  id: string;
  ownerUid: string;
  saleNo: string;
  customerName: string;
  customerPhone: string;
  subtotal: number;
  discount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountTendered: number;
  changeDue: number;
  staffName: string;
  createdAtMs: number;
}

export interface PosSaleItem {
  id: string;
  ownerUid: string;
  saleId: string;
  inventoryItemId: string;
  itemName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface WorkshopBooking {
  id: string;
  ownerUid: string;
  bookingNo: string;
  customerName: string;
  customerPhone: string;
  deviceType: string;
  deviceModel: string;
  deviceBarcode: string;
  issueSummary: string;
  scheduledDate: string;
  status: BookingStatus;
  convertedTicketId: string;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface StoreSnapshot {
  shopProfile: ShopProfile;
  savedThemes: SavedTheme[];
  staff: StaffMember[];
  tickets: RepairTicket[];
  ticketParts: TicketPart[];
  ticketTimeline: TicketTimelineEntry[];
  inventory: InventoryItem[];
  posSales: PosSale[];
  posSaleItems: PosSaleItem[];
  bookings: WorkshopBooking[];
  lastSyncMs: number;
}

export interface StoreBackupPayload {
  version: number;
  exportedAtMs: number;
  appName: string;
  snapshot: StoreSnapshot;
}

export type PrintJob =
  | { type: 'part-label'; item: InventoryItem }
  | { type: 'rack-label'; rackName: string; items: InventoryItem[] }
  | { type: 'intake-sticker'; ticket: RepairTicket }
  | { type: 'ticket-receipt'; ticket: RepairTicket; parts: TicketPart[] }
  | { type: 'pos-receipt'; sale: PosSale; items: PosSaleItem[] }
  | {
      type: 'summary-report';
      mode: 'daily' | 'monthly';
      periodLabel: string;
      metrics: SummaryMetrics;
    };

export interface SummaryMetrics {
  totalCollected: number;
  posSalesTotal: number;
  posSalesCount: number;
  ticketSettlementsTotal: number;
  ticketSettlementsCount: number;
  advanceDepositsTotal: number;
  advanceDepositsCount: number;
  cashTotal: number;
  cardTotal: number;
  onlineTotal: number;
  newIntakesCount: number;
  readyCount: number;
  deliveredCount: number;
  partsBilledTotal: number;
  laborBilledTotal: number;
  openBalancesTotal: number;
  bookingsCount: number;
  stockInTotal: number;
  stockOutTotal: number;
}

export const BRAND_FOOTER = 'Powered by Sahasna Tech Solution, Elpitiya | 0702809995';
export const BRAND_SUBTITLE = 'Powered by Sahasna Tech Solution, Elpitiya • 0702809995';

export const PRESET_THEMES: Omit<SavedTheme, 'ownerUid'>[] = [
  {
    id: 'classic-store',
    name: 'Classic Store',
    primary: '#1D4ED8',
    header: '#1E293B',
    background: '#F8FAFC',
    surface: '#FFFFFF',
    accent: '#0F766E',
    text: '#0F172A',
    cornerRadius: 10,
    isPreset: true,
  },
  {
    id: 'emerald-workshop',
    name: 'Emerald Workshop',
    primary: '#047857',
    header: '#064E3B',
    background: '#F4FBF7',
    surface: '#FFFFFF',
    accent: '#1D4ED8',
    text: '#0F172A',
    cornerRadius: 10,
    isPreset: true,
  },
  {
    id: 'amber-counter',
    name: 'Amber Counter',
    primary: '#B45309',
    header: '#292524',
    background: '#FAF8F5',
    surface: '#FFFFFF',
    accent: '#0369A1',
    text: '#1C1917',
    cornerRadius: 10,
    isPreset: true,
  },
  {
    id: 'graphite-pro',
    name: 'Graphite Pro',
    primary: '#2563EB',
    header: '#0F172A',
    background: '#F1F5F9',
    surface: '#FFFFFF',
    accent: '#059669',
    text: '#0F172A',
    cornerRadius: 8,
    isPreset: true,
  },
];

export function createDefaultShopProfile(ownerUid: string): ShopProfile {
  return {
    id: 'default',
    ownerUid,
    shopName: 'Store',
    shopPhone: '0702809995',
    shopAddress: 'Elpitiya',
    currencySymbol: 'Rs.',
    receiptFooter: BRAND_FOOTER,
    nextTicketSeq: 1001,
    nextSaleSeq: 5001,
    nextBookingSeq: 201,
    activeThemeId: 'classic-store',
    themePrimary: '#1D4ED8',
    themeHeader: '#1E293B',
    themeBackground: '#F8FAFC',
    themeSurface: '#FFFFFF',
    themeAccent: '#0F766E',
    themeText: '#0F172A',
    cornerRadius: 10,
  };
}
