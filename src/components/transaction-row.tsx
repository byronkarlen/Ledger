import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { CATEGORY_MAP, type Category } from '@/constants/categories';
import { Spacing, useTheme } from '@/constants/theme';
import { formatCurrency, formatDayShort } from '@/lib/spending';
import type { SpendingItem } from '@/store/ledger';

const ICON_SIZE = 40;

/** Colored circle with the category's SF Symbol, shared by all list rows. */
export function CategoryBadge({ category }: { category: Category }) {
  return (
    <View style={[styles.iconBadge, { backgroundColor: category.color }]}>
      <SymbolView name={category.icon} size={18} tintColor="#ffffff" />
    </View>
  );
}

/** Hairline divider inset past the category badge, shared by all lists. */
export function RowSeparator() {
  const theme = useTheme();
  return <View style={[styles.separator, { backgroundColor: theme.backgroundElement }]} />;
}

export const TransactionRow = memo(function TransactionRow({ item }: { item: SpendingItem }) {
  const category = CATEGORY_MAP[item.category];
  return (
    <View style={styles.row}>
      <CategoryBadge category={category} />
      <View style={styles.rowText}>
        <ThemedText type="default" numberOfLines={1}>
          {item.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {category.label} · {formatDayShort(item.date)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={styles.amount}>
        {formatCurrency(item.amount)}
      </ThemedText>
    </View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  iconBadge: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: 1,
    marginLeft: ICON_SIZE + Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  amount: {
    fontSize: 16,
  },
});
