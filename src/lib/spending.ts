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

/** Ordinal day, e.g. "1st", "22nd" — used for recurring rule schedules. */
export function formatDayOrdinal(day: number): string {
  const tens = day % 100;
  if (tens >= 11 && tens <= 13) return `${day}th`;
  const suffix = { 1: 'st', 2: 'nd', 3: 'rd' }[day % 10] ?? 'th';
  return `${day}${suffix}`;
}

/**
 * Local-noon ISO timestamp for the given calendar day (month is 1-based),
 * clamping the day to the month's length: a day-31 rule posts on Feb 28.
 */
export function clampedDateISO(year: number, month: number, day: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return new Date(year, month - 1, Math.min(day, lastDay), 12).toISOString();
}

/** The rule's occurrence in the calendar month after `fromISO`. */
export function dueDateNextMonth(fromISO: string, dayOfMonth: number): string {
  const from = new Date(fromISO);
  const wraps = from.getMonth() === 11;
  return clampedDateISO(
    from.getFullYear() + (wraps ? 1 : 0),
    wraps ? 1 : from.getMonth() + 2,
    dayOfMonth,
  );
}

/**
 * All due dates for a monthly rule from its watermark through `now`, plus the
 * advanced watermark. Each month re-clamps from `dayOfMonth`, so a day-31
 * rule posts Feb 28 and then returns to the 31st in longer months.
 */
export function occurrencesThrough(
  nextDueDate: string,
  dayOfMonth: number,
  now: Date,
): { dates: string[]; nextDueDate: string } {
  const dates: string[] = [];
  let due = nextDueDate;
  while (new Date(due).getTime() <= now.getTime()) {
    dates.push(due);
    due = dueDateNextMonth(due, dayOfMonth);
  }
  return { dates, nextDueDate: due };
}

/** Whole dollars, e.g. "$1,310" — the app ignores cent granularity. */
export function formatCurrency(amount: number): string {
  return `$${Math.round(amount).toLocaleString('en-US')}`;
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
