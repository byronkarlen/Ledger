import Storage from 'expo-sqlite/kv-store';
import { AppState, Platform } from 'react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import type { CategoryKey } from '@/constants/categories';
import {
  categoryBreakdown,
  clampedDateISO,
  currentMonthKey,
  dueDateNextMonth,
  formatCurrency,
  formatMonthName,
  itemsInMonth,
  occurrencesThrough,
  sumAmounts,
} from '@/lib/spending';
import AddExpenseWidget from '@/widgets/add-expense-widget';

export type SpendingItem = {
  id: string;
  title: string;
  amount: number;
  category: CategoryKey;
  date: string;
  /** Set on transactions generated from a recurring rule. Provenance only:
      the transaction never writes back to the rule, and the id survives rule
      deletion. */
  recurringRuleId?: string;
};

export type NewSpendingItem = Omit<SpendingItem, 'id'>;

export type RecurringRule = {
  id: string;
  title: string;
  amount: number;
  category: CategoryKey;
  /** 1–31; clamped to each month's length at generation time. */
  dayOfMonth: number;
  /** Watermark: the earliest occurrence not yet materialized. Generation
      walks forward from here, so a deleted occurrence never regenerates. */
  nextDueDate: string;
};

type LedgerContextValue = {
  items: SpendingItem[];
  rules: RecurringRule[];
  addItem: (item: NewSpendingItem) => void;
  updateItem: (item: SpendingItem) => void;
  deleteItem: (id: string) => void;
  /** Creates a rule anchored to the item's day plus the first transaction. */
  addRecurring: (item: NewSpendingItem) => void;
  updateRule: (rule: RecurringRule) => void;
  deleteRule: (id: string) => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

const STORAGE_KEY = 'ledger.items.v1';
const RULES_KEY = 'ledger.rules.v1';

const byDateDesc = (a: SpendingItem, b: SpendingItem) => b.date.localeCompare(a.date);

/**
 * Materialize every occurrence due through `now`. Items whose deterministic
 * id already exists are skipped: that closes the crash window where items
 * persisted but the advanced watermark didn't.
 */
function runCatchUp(rules: RecurringRule[], now: Date, existingIds: Set<string>) {
  const newItems: SpendingItem[] = [];
  let changed = false;
  const nextRules = rules.map((rule) => {
    const { dates, nextDueDate } = occurrencesThrough(rule.nextDueDate, rule.dayOfMonth, now);
    if (dates.length === 0) return rule;
    changed = true;
    for (const date of dates) {
      const id = `${rule.id}:${date.slice(0, 10)}`;
      if (existingIds.has(id)) continue;
      newItems.push({
        id,
        title: rule.title,
        amount: rule.amount,
        category: rule.category,
        date,
        recurringRuleId: rule.id,
      });
    }
    return { ...rule, nextDueDate };
  });
  return { newItems, nextRules, changed };
}

// The widget's category bar sizes segments in container-relative units where
// 100 = the widget's full width; ~90 units approximates the padded content
// width. Quantize each category's share into those units, minimum 1, and
// settle rounding drift on the largest segment.
const WIDGET_BAR_UNITS = 90;
function widgetSegments(items: SpendingItem[]) {
  const breakdown = categoryBreakdown(items);
  const total = sumAmounts(items);
  if (total <= 0 || breakdown.length === 0) return [];
  const segments = breakdown.map((b) => ({
    color: b.category.color,
    span: Math.max(1, Math.round((b.amount / total) * WIDGET_BAR_UNITS)),
  }));
  const drift = WIDGET_BAR_UNITS - segments.reduce((sum, s) => sum + s.span, 0);
  segments[0].span = Math.max(1, segments[0].span + drift);
  return segments;
}

/** Local calendar date (month is 1-based) as an ISO timestamp. */
function d(year: number, month: number, day: number): string {
  return new Date(year, month - 1, day, 12).toISOString();
}

const SEED_ITEMS: SpendingItem[] = [
  // July 2026 (current month)
  { id: '1', title: 'Whole Foods', amount: 84.32, category: 'grocery', date: d(2026, 7, 23) },
  { id: '2', title: 'Chipotle', amount: 13.75, category: 'fastFood', date: d(2026, 7, 23) },
  { id: '3', title: 'Shell Gas', amount: 52.1, category: 'car', date: d(2026, 7, 22) },
  { id: '4', title: 'Rent', amount: 1850, category: 'housing', date: d(2026, 7, 21) },
  { id: '5', title: 'Uniqlo', amount: 96.4, category: 'shopping', date: d(2026, 7, 20) },
  { id: '6', title: 'Delta Airlines', amount: 342.0, category: 'travel', date: d(2026, 7, 19) },
  { id: '7', title: 'Sushi Nakazawa', amount: 128.5, category: 'restaurants', date: d(2026, 7, 18) },
  { id: '8', title: "Trader Joe's", amount: 61.18, category: 'grocery', date: d(2026, 7, 17) },
  { id: '9', title: 'Spotify', amount: 11.99, category: 'other', date: d(2026, 7, 16) },
  { id: '10', title: "McDonald's", amount: 9.45, category: 'fastFood', date: d(2026, 7, 15) },
  // June 2026
  { id: '11', title: 'Rent', amount: 1850, category: 'housing', date: d(2026, 6, 1) },
  { id: '12', title: 'Costco', amount: 210.4, category: 'grocery', date: d(2026, 6, 5) },
  { id: '13', title: 'Shell Gas', amount: 48.9, category: 'car', date: d(2026, 6, 8) },
  { id: '14', title: 'Olive Garden', amount: 74.2, category: 'restaurants', date: d(2026, 6, 12) },
  { id: '15', title: 'Nike', amount: 132.0, category: 'shopping', date: d(2026, 6, 15) },
  { id: '16', title: 'Airbnb', amount: 520.0, category: 'travel', date: d(2026, 6, 20) },
  { id: '17', title: 'Taco Bell', amount: 15.3, category: 'fastFood', date: d(2026, 6, 22) },
  { id: '18', title: 'Amazon', amount: 63.75, category: 'other', date: d(2026, 6, 25) },
  // May 2026
  { id: '19', title: 'Rent', amount: 1850, category: 'housing', date: d(2026, 5, 1) },
  { id: '20', title: 'Whole Foods', amount: 96.1, category: 'grocery', date: d(2026, 5, 4) },
  { id: '21', title: 'Chevron', amount: 55.0, category: 'car', date: d(2026, 5, 9) },
  { id: '22', title: 'Local Diner', amount: 42.8, category: 'restaurants', date: d(2026, 5, 14) },
  { id: '23', title: 'Zara', amount: 88.5, category: 'shopping', date: d(2026, 5, 18) },
  { id: '24', title: 'Netflix', amount: 15.49, category: 'other', date: d(2026, 5, 20) },
  { id: '25', title: "Wendy's", amount: 11.2, category: 'fastFood', date: d(2026, 5, 27) },
];

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SpendingItem[]>([]);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  // Bumped when the app returns to the foreground, to re-run the catch-up.
  const [foregroundTick, setForegroundTick] = useState(0);
  // Guards the initial hydration so we don't overwrite stored data with the empty seed.
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [rawItems, rawRules] = await Promise.all([
          Storage.getItem(STORAGE_KEY),
          Storage.getItem(RULES_KEY),
        ]);
        if (rawItems) {
          setItems((JSON.parse(rawItems) as SpendingItem[]).sort(byDateDesc));
        } else {
          const seeded = [...SEED_ITEMS].sort(byDateDesc);
          setItems(seeded);
          await Storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        }
        if (rawRules) setRules(JSON.parse(rawRules) as RecurringRule[]);
      } catch {
        setItems([...SEED_ITEMS].sort(byDateDesc));
      } finally {
        hydrated.current = true;
      }
    })();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setForegroundTick((t) => t + 1);
    });
    return () => sub.remove();
  }, []);

  // Catch-up: materialize occurrences that came due. Runs after hydration,
  // after any rule change, and on each return to the foreground (an app left
  // open across a due date still posts). Idempotent via the watermark, so
  // the re-run triggered by its own state updates settles immediately.
  useEffect(() => {
    if (!hydrated.current) return;
    const existingIds = new Set(items.map((i) => i.id));
    const { newItems, nextRules, changed } = runCatchUp(rules, new Date(), existingIds);
    if (!changed) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronizing with wall-clock time, not derived state; the watermark guarantees this settles in one extra render
    setRules(nextRules);
    if (newItems.length > 0) setItems((prev) => [...newItems, ...prev].sort(byDateDesc));
  }, [items, rules, foregroundTick]);

  // Persist whenever items change, but only after the initial load. The
  // home-screen widget shows the same numbers, so it refreshes here too.
  useEffect(() => {
    if (!hydrated.current) return;
    Storage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
    if (Platform.OS === 'ios') {
      const month = currentMonthKey();
      const monthItems = itemsInMonth(items, month);
      AddExpenseWidget.updateSnapshot({
        totalLabel: formatCurrency(sumAmounts(monthItems)),
        monthLabel: formatMonthName(month),
        segments: widgetSegments(monthItems),
      });
    }
  }, [items]);

  // Rules persist separately so an item edit doesn't rewrite them (and vice versa).
  useEffect(() => {
    if (!hydrated.current) return;
    Storage.setItem(RULES_KEY, JSON.stringify(rules)).catch(() => {});
  }, [rules]);

  const addItem = useCallback((item: NewSpendingItem) => {
    const id = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    setItems((prev) => [{ ...item, id }, ...prev].sort(byDateDesc));
  }, []);

  const updateItem = useCallback((item: SpendingItem) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? item : i)).sort(byDateDesc));
  }, []);

  const deleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const addRecurring = useCallback((item: NewSpendingItem) => {
    const anchor = new Date(item.date);
    const ruleId = `rule-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const rule: RecurringRule = {
      id: ruleId,
      title: item.title,
      amount: item.amount,
      category: item.category,
      dayOfMonth: anchor.getDate(),
      // Today's occurrence is created right here, so the watermark starts
      // one month out.
      nextDueDate: dueDateNextMonth(item.date, anchor.getDate()),
    };
    setRules((prev) => [...prev, rule]);
    setItems((prev) =>
      [{ ...item, id: `${ruleId}:${item.date.slice(0, 10)}`, recurringRuleId: ruleId }, ...prev].sort(
        byDateDesc,
      ),
    );
  }, []);

  const updateRule = useCallback((rule: RecurringRule) => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.id !== rule.id) return r;
        // Keep the watermark's month — already-covered months stay covered,
        // nothing double-posts — but re-anchor it to the (possibly changed)
        // day. If that lands in the past, the catch-up posts it immediately.
        const due = new Date(r.nextDueDate);
        return {
          ...rule,
          nextDueDate: clampedDateISO(due.getFullYear(), due.getMonth() + 1, rule.dayOfMonth),
        };
      }),
    );
  }, []);

  // Rule only: transactions it generated stay in the ledger.
  const deleteRule = useCallback((id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const value = useMemo(
    () => ({ items, rules, addItem, updateItem, deleteItem, addRecurring, updateRule, deleteRule }),
    [items, rules, addItem, updateItem, deleteItem, addRecurring, updateRule, deleteRule],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within a LedgerProvider');
  return ctx;
}
