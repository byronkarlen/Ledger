import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSpendingSheet } from '@/components/add-spending-sheet';
import { NativeSelect, type SelectOption } from '@/components/native-select';
import { ThemedText } from '@/components/themed-text';
import { RowSeparator, TransactionRow } from '@/components/transaction-row';
import { CATEGORY_OPTIONS, isCategoryKey, type CategoryKey } from '@/constants/categories';
import { PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import { formatCurrency, groupByMonth, sumAmounts } from '@/lib/spending';
import { useLedger, type SpendingItem } from '@/store/ledger';

type Filter = CategoryKey | 'all';

const FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Expenses' },
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

  const handleFilterChange = useCallback((v: string) => setFilter(v as Filter), []);

  const sections = useMemo(() => {
    const filtered = filter === 'all' ? items : items.filter((i) => i.category === filter);
    return groupByMonth(filtered);
  }, [items, filter]);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* The active filter is the title: the title area names the current
          scope, like the month header does on the main screen. */}
      <Stack.Screen
        options={{
          headerTitle: () => (
            <NativeSelect
              label="Category"
              appearance="title"
              options={FILTER_OPTIONS}
              value={filter}
              onChange={handleFilterChange}
            />
          ),
        }}
      />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        // Without this the screen's content starts under the navigation bar,
        // hiding the first section header.
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: Spacing.four,
          paddingBottom: insets.bottom + Spacing.five,
        }}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
            {/* With a category selected, the month header carries that
                category's monthly total, mid-dot separated like the row
                subtitles. Omitted for "all": the Spending page already
                answers that question. */}
            <ThemedText type="smallBold" themeColor="textSecondary">
              {section.title}
              {filter !== 'all' && ` · ${formatCurrency(sumAmounts(section.data))}`}
            </ThemedText>
          </View>
        )}
        // Tap to edit; deletion lives in the edit sheet. (Swipe-to-delete was
        // tried and removed — not worth the complexity.)
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
            No expenses for this category.
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
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
  // Same pressed feedback as the breakdown rows on the Spending page.
  pressed: {
    opacity: PressedOpacity,
  },
});
