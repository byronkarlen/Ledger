import type { SFSymbol } from 'sf-symbols-typescript';

export type CategoryKey =
  | 'housing'
  | 'car'
  | 'grocery'
  | 'fastFood'
  | 'restaurants'
  | 'health'
  | 'shopping'
  | 'recreation'
  | 'entertainment'
  | 'travel'
  | 'other';

export type Category = {
  key: CategoryKey;
  label: string;
  /** SF Symbol shown in the ledger row and category picker. */
  icon: SFSymbol;
  /** Distinct hue used for the pie slice and accents. Based on iOS system colors. */
  color: string;
};

/** Array order is the display order in pickers and menus. */
export const CATEGORIES: Category[] = [
  { key: 'housing', label: 'Housing', icon: 'house.fill', color: '#007AFF' },
  { key: 'car', label: 'Car', icon: 'car.fill', color: '#5AC8FA' },
  { key: 'grocery', label: 'Grocery', icon: 'cart.fill', color: '#34C759' },
  { key: 'fastFood', label: 'Fast Food', icon: 'takeoutbag.and.cup.and.straw.fill', color: '#FF9500' },
  { key: 'restaurants', label: 'Restaurants', icon: 'fork.knife', color: '#FF3B30' },
  { key: 'health', label: 'Health', icon: 'heart.fill', color: '#00C7BE' },
  { key: 'shopping', label: 'Shopping', icon: 'bag.fill', color: '#FF2D92' },
  { key: 'recreation', label: 'Recreation', icon: 'gamecontroller.fill', color: '#AF52DE' },
  { key: 'entertainment', label: 'Entertainment', icon: 'ticket.fill', color: '#FFCC00' },
  { key: 'travel', label: 'Travel', icon: 'airplane', color: '#5856D6' },
  { key: 'other', label: 'Other', icon: 'ellipsis.circle.fill', color: '#8E8E93' },
];

export const CATEGORY_MAP: Record<CategoryKey, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, c]),
) as Record<CategoryKey, Category>;

/** CATEGORIES as options for NativeSelect. */
export const CATEGORY_OPTIONS = CATEGORIES.map((c) => ({ value: c.key, label: c.label }));

export function isCategoryKey(value: unknown): value is CategoryKey {
  return typeof value === 'string' && value in CATEGORY_MAP;
}
