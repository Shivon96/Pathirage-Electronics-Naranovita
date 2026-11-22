import type { StoreSnapshot, SummaryMetrics } from '../types';

export function getDayBounds(dateStr: string): { start: number; end: number } {
  const [y, m, d] = dateStr.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, d || 1, 0, 0, 0, 0).getTime();
  const end = new Date(y, (m || 1) - 1, d || 1, 23, 59, 59, 999).getTime();
  return { start, end };
}

export function getMonthBounds(monthStr: string): { start: number; end: number } {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, (m || 1) - 1, 1, 0, 0, 0, 0).getTime();
  const end = new Date(y, m || 1, 0, 23, 59, 59, 999).getTime();
  return { start, end };
}

export function computeSummaryMetrics(
  snapshot: StoreSnapshot,
  startMs: number,
  endMs: number
): SummaryMetrics {
  const inRange = (ms: number) => ms >= startMs && ms <= endMs;

  const salesInRange = snapshot.posSales.filter((s) => inRange(s.createdAtMs));
  const posSalesTotal = salesInRange.reduce((sum, s) => sum + s.totalAmount, 0);
  const posSalesCount = salesInRange.length;

  let ticketSettlementsTotal = 0;
  let ticketSettlementsCount = 0;
  let advanceDepositsTotal = 0;
  let advanceDepositsCount = 0;
  let cashTotal = 0;
  let cardTotal = 0;
  let onlineTotal = 0;

  for (const s of salesInRange) {
    if (s.paymentMethod === 'Cash') cashTotal += s.totalAmount;
    else if (s.paymentMethod === 'Card') cardTotal += s.totalAmount;
    else if (s.paymentMethod === 'Online') onlineTotal += s.totalAmount;
  }

  for (const t of snapshot.tickets) {
    if (t.advanceDeposit > 0 && inRange(t.depositPaidAtMs || t.createdAtMs)) {
      advanceDepositsTotal += t.advanceDeposit;
      advanceDepositsCount += 1;
      if (t.depositMethod === 'Cash') cashTotal += t.advanceDeposit;
      else if (t.depositMethod === 'Card') cardTotal += t.advanceDeposit;
      else if (t.depositMethod === 'Online') onlineTotal += t.advanceDeposit;
    }
    if (t.settledAmount > 0 && inRange(t.settledAtMs || t.updatedAtMs)) {
      ticketSettlementsTotal += t.settledAmount;
      ticketSettlementsCount += 1;
      if (t.settlementMethod === 'Cash') cashTotal += t.settledAmount;
      else if (t.settlementMethod === 'Card') cardTotal += t.settledAmount;
      else if (t.settlementMethod === 'Online') onlineTotal += t.settledAmount;
    }
  }

  const ticketsCreated = snapshot.tickets.filter((t) => inRange(t.createdAtMs));
  const newIntakesCount = ticketsCreated.length;
  const readyCount = snapshot.tickets.filter(
    (t) => t.status === 'Ready for Pickup' && inRange(t.updatedAtMs)
  ).length;
  const deliveredCount = snapshot.tickets.filter(
    (t) => t.status === 'Delivered' && inRange(t.updatedAtMs)
  ).length;

  const partsBilledTotal = ticketsCreated.reduce((sum, t) => sum + t.partsTotal, 0);
  const laborBilledTotal = ticketsCreated.reduce((sum, t) => sum + t.laborCharge, 0);
  const openBalancesTotal = snapshot.tickets
    .filter((t) => t.balanceDue > 0)
    .reduce((sum, t) => sum + t.balanceDue, 0);

  const bookingsCount = snapshot.bookings.filter((b) => inRange(b.createdAtMs)).length;
  const stockInTotal = snapshot.inventory.reduce((sum, i) => sum + (i.stockInTotal || 0), 0);
  const stockOutTotal = snapshot.inventory.reduce((sum, i) => sum + (i.stockOutTotal || 0), 0);

  return {
    totalCollected: posSalesTotal + ticketSettlementsTotal + advanceDepositsTotal,
    posSalesTotal,
    posSalesCount,
    ticketSettlementsTotal,
    ticketSettlementsCount,
    advanceDepositsTotal,
    advanceDepositsCount,
    cashTotal,
    cardTotal,
    onlineTotal,
    newIntakesCount,
    readyCount,
    deliveredCount,
    partsBilledTotal,
    laborBilledTotal,
    openBalancesTotal,
    bookingsCount,
    stockInTotal,
    stockOutTotal,
  };
}
