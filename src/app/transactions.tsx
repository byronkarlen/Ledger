import { useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSpendingSheet } from '@/components/add-spending-sheet';
import { NativeSelect, type SelectOption } from '@/components/native-select';
import { ThemedText } from '@/components/themed-text';
import { RowSeparator, TransactionRow } from '@/components/transaction-row';
import { CATEGORY_OPTIONS, isCategoryKey, type CategoryKey } from '@/constants/categories';
import { PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import { groupByMonth } from '@/lib/spending';
import { useLedger, type SpendingItem } from '@/store/ledger';

type Filter = CategoryKey | 'all';

const FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Categories' },
  ...CATEGORY_OPTIONS,
];

export default function TransactionsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();

  const [filter, setFilter] = useState<Filter>(
    isCategoryKey(params.category) ? params.category : 'all',
  );
  const [editItem, setEditItem] = useState<SpendingItem | null>(null);

  const { items } = useLedger();

  // Stable handler so the memoized NativeSelect skips unrelated re-renders.
  const handleFilterChange = useCallback((v: string) => setFilter(v as Filter), []);

  const sections = useMemo(() => {
    const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter);
    return groupByMonth(filtered);
  }, [items, filter]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        // Without this the screen's content starts under the navigation bar,
        // hiding the filter row and the first section header.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: Spacing.four,
          paddingBottom: insets.bottom + Spacing.five,
        }}
        // Inside the list so it shares the same header inset as the rows.
        ListHeaderComponent={
          <View style={styles.filterBar}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              Category:
            </ThemedText>
            <NativeSelect
              label="Category"
              options={FILTER_OPTIONS}
              value={filter}
              onChange={handleFilterChange}
              style={styles.filterSelect}
            />
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {section.title}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditItem(item)}
            style={({ pressed }) => pressed && styles.pressed}>
            <TransactionRow item={item} />
          </Pressable>
        )}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            No transactions for this filter.
          </ThemedText>
        }
      />

      <AddSpendingSheet
        visible={!!editItem}
        editItem={editItem}
        onClose={() => setEditItem(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filterSelect: {
    alignSelf: 'flex-start',
  },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
