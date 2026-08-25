import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSpendingSheet } from '@/components/add-spending-sheet';
import { NativeSelect, type SelectOption } from '@/components/native-select';
import { ThemedText } from '@/components/themed-text';
import { RowSeparator, TransactionRow } from '@/components/transaction-row';
import { CATEGORY_OPTIONS, isCategoryKey, type CategoryKey } from '@/constants/categories';
import { Danger, PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import { groupByMonth } from '@/lib/spending';
import { useLedger, type SpendingItem } from '@/store/ledger';

type Filter = CategoryKey | 'all';

const FILTER_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All Transactions' },
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

  const { items, deleteItem } = useLedger();

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
            <ThemedText type="smallBold" themeColor="textSecondary">
              {section.title}
            </ThemedText>
          </View>
        )}
        renderItem={({ item }) => (
          <ReanimatedSwipeable
            friction={2}
            rightThreshold={40}
            renderRightActions={() => (
              <Pressable
                onPress={() => deleteItem(item.id)}
                accessibilityRole="button"
                accessibilityLabel="Delete"
                style={({ pressed }) => [styles.deleteAction, pressed && styles.pressed]}>
                <SymbolView name="trash.fill" size={20} tintColor="#ffffff" />
              </Pressable>
            )}>
            {/* Opaque background so the delete action stays hidden until the
                row actually slides. */}
            <Pressable
              onPress={() => setEditItem(item)}
              style={({ pressed }) => [
                { backgroundColor: theme.background },
                pressed && styles.pressed,
              ]}>
              <TransactionRow item={item} />
            </Pressable>
          </ReanimatedSwipeable>
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
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  deleteAction: {
    backgroundColor: Danger,
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
