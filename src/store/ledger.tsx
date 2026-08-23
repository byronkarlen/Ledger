import Storage from 'expo-sqlite/kv-store';
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

export type SpendingItem = {
  id: string;
  title: string;
  amount: number;
  category: CategoryKey;
  date: string;
};

export type NewSpendingItem = Omit<SpendingItem, 'id'>;

type LedgerContextValue = {
  items: SpendingItem[];
  addItem: (item: NewSpendingItem) => void;
  updateItem: (item: SpendingItem) => void;
  deleteItem: (id: string) => void;
};

const LedgerContext = createContext<LedgerContextValue | null>(null);

const STORAGE_KEY = 'ledger.items.v1';

const byDateDesc = (a: SpendingItem, b: SpendingItem) => b.date.localeCompare(a.date);

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
  { id: '5', title: 'Uniqlo', amount: 96.4, category: 'clothing', date: d(2026, 7, 20) },
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
  { id: '15', title: 'Nike', amount: 132.0, category: 'clothing', date: d(2026, 6, 15) },
  { id: '16', title: 'Airbnb', amount: 520.0, category: 'travel', date: d(2026, 6, 20) },
  { id: '17', title: 'Taco Bell', amount: 15.3, category: 'fastFood', date: d(2026, 6, 22) },
  { id: '18', title: 'Amazon', amount: 63.75, category: 'other', date: d(2026, 6, 25) },
  // May 2026
  { id: '19', title: 'Rent', amount: 1850, category: 'housing', date: d(2026, 5, 1) },
  { id: '20', title: 'Whole Foods', amount: 96.1, category: 'grocery', date: d(2026, 5, 4) },
  { id: '21', title: 'Chevron', amount: 55.0, category: 'car', date: d(2026, 5, 9) },
  { id: '22', title: 'Local Diner', amount: 42.8, category: 'restaurants', date: d(2026, 5, 14) },
  { id: '23', title: 'Zara', amount: 88.5, category: 'clothing', date: d(2026, 5, 18) },
  { id: '24', title: 'Netflix', amount: 15.49, category: 'other', date: d(2026, 5, 20) },
  { id: '25', title: "Wendy's", amount: 11.2, category: 'fastFood', date: d(2026, 5, 27) },
];

export function LedgerProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SpendingItem[]>([]);
  // Guards the initial hydration so we don't overwrite stored data with the empty seed.
  const hydrated = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await Storage.getItem(STORAGE_KEY);
        if (raw) {
          setItems((JSON.parse(raw) as SpendingItem[]).sort(byDateDesc));
        } else {
          const seeded = [...SEED_ITEMS].sort(byDateDesc);
          setItems(seeded);
          await Storage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        }
      } catch {
        setItems([...SEED_ITEMS].sort(byDateDesc));
      } finally {
        hydrated.current = true;
      }
    })();
  }, []);

  // Persist whenever items change, but only after the initial load.
  useEffect(() => {
    if (!hydrated.current) return;
    Storage.setItem(STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  }, [items]);

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

  const value = useMemo(
    () => ({ items, addItem, updateItem, deleteItem }),
    [items, addItem, updateItem, deleteItem],
  );

  return <LedgerContext.Provider value={value}>{children}</LedgerContext.Provider>;
}

export function useLedger(): LedgerContextValue {
  const ctx = useContext(LedgerContext);
  if (!ctx) throw new Error('useLedger must be used within a LedgerProvider');
  return ctx;
}
