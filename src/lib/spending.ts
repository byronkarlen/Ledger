import { CATEGORIES, type CategoryKey } from '@/constants/categories';
import type { SpendingItem } from '@/store/ledger';

/** Month identity as "YYYY-MM", safe to compare and sort lexicographically. */
export type MonthKey = string;

function monthKeyFromDate(d: Date): MonthKey {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function dateFromMonthKey(key: MonthKey): Date {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1);
}

export function monthKeyFromISO(iso: string): MonthKey {
  return iso.slice(0, 7);
}

export function currentMonthKey(): MonthKey {
  return monthKeyFromDate(new Date());
}

/** Shift a month key by a number of months (positive = future). */
export function addMonths(key: MonthKey, delta: number): MonthKey {
  const d = dateFromMonthKey(key);
  d.setMonth(d.getMonth() + delta);
  return monthKeyFromDate(d);
}

export function formatMonthLong(key: MonthKey): string {
  return dateFromMonthKey(key).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/** Just the month name, e.g. "July" — used inside the pie chart. */
export function formatMonthName(key: MonthKey): string {
  return dateFromMonthKey(key).toLocaleDateString('en-US', { month: 'long' });
}

/**
 * Carousel label: just the month ("Jul") within the current year, with a
 * short year ("Jul '25") only where it would otherwise be ambiguous.
 */
export function formatMonthChip(key: MonthKey): string {
  const date = dateFromMonthKey(key);
  const month = date.toLocaleDateString('en-US', { month: 'short' });
  const thisYear = new Date().getFullYear();
  return date.getFullYear() === thisYear ? month : `${month} '${key.slice(2, 4)}`;
}

/**
 * Every month from the earliest recorded purchase through the current month,
 * oldest first, so the carousel always ends on "now".
 */
export function monthOptions(items: SpendingItem[]): MonthKey[] {
  const current = currentMonthKey();
  let earliest = current;
  for (const item of items) {
    const key = monthKeyFromISO(item.date);
    if (key < earliest) earliest = key;
  }

  const months: MonthKey[] = [];
  for (let key = earliest; key <= current; key = addMonths(key, 1)) {
    months.push(key);
  }
  return months;
}

/** Short day form, e.g. "Jul 23" — used in transaction rows. */
export function formatDayShort(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function formatCurrency(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Rounded, no cents — used for headline totals and breakdowns (e.g. "$1,310"). */
export function formatDollars(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
}

export function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function sumAmounts(items: SpendingItem[]): number {
  return items.reduce((sum, i) => sum + i.amount, 0);
}

export function itemsInMonth(items: SpendingItem[], key: MonthKey): SpendingItem[] {
  return items.filter((i) => monthKeyFromISO(i.date) === key);
}

export type CategoryBreakdown = {
  category: (typeof CATEGORIES)[number];
  amount: number;
  pct: number;
};

/** Totals per category for the given items, sorted by amount descending, omitting empty categories. */
export function categoryBreakdown(items: SpendingItem[]): CategoryBreakdown[] {
  const total = sumAmounts(items);
  const totals = new Map<CategoryKey, number>();
  for (const item of items) {
    totals.set(item.category, (totals.get(item.category) ?? 0) + item.amount);
  }
  return CATEGORIES.map((category) => {
    const amount = totals.get(category.key) ?? 0;
    return { category, amount, pct: total > 0 ? (amount / total) * 100 : 0 };
  })
    .filter((b) => b.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export type MonthSection = {
  key: MonthKey;
  title: string;
  data: SpendingItem[];
};

/** Group items into month sections (newest first) for a sectioned transaction list. */
export function groupByMonth(items: SpendingItem[]): MonthSection[] {
  const buckets = new Map<MonthKey, SpendingItem[]>();
  for (const item of [...items].sort((a, b) => b.date.localeCompare(a.date))) {
    const key = monthKeyFromISO(item.date);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }
  return Array.from(buckets, ([key, data]) => ({ key, title: formatMonthLong(key), data })).sort(
    (a, b) => b.key.localeCompare(a.key),
  );
}
