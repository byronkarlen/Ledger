import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSpendingSheet } from '@/components/add-spending-sheet';
import { ThemedText } from '@/components/themed-text';
import { CategoryBadge, RowSeparator } from '@/components/transaction-row';
import { CATEGORY_MAP } from '@/constants/categories';
import { PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import { formatCurrency, formatDayOrdinal } from '@/lib/spending';
import { useLedger, type RecurringRule } from '@/store/ledger';

export default function RecurringScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { rules } = useLedger();
  const [editRule, setEditRule] = useState<RecurringRule | null>(null);

  const sorted = useMemo(
    () =>
      [...rules].sort((a, b) => a.dayOfMonth - b.dayOfMonth || a.title.localeCompare(b.title)),
    [rules],
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <FlatList
        data={sorted}
        keyExtractor={(rule) => rule.id}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          paddingHorizontal: Spacing.four,
          paddingTop: Spacing.two,
          paddingBottom: insets.bottom + Spacing.five,
        }}
        // Tap to edit; deletion lives in the edit sheet — same pattern as the
        // transactions list.
        renderItem={({ item }) => (
          <Pressable
            onPress={() => setEditRule(item)}
            style={({ pressed }) => pressed && styles.pressed}>
            <RecurringRow rule={item} />
          </Pressable>
        )}
        ItemSeparatorComponent={RowSeparator}
        ListEmptyComponent={
          <View style={styles.empty}>
            <SymbolView name="repeat" size={44} tintColor={theme.textSecondary} />
            <ThemedText type="default" themeColor="textSecondary">
              No recurring expenses
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.emptyHint}>
              Set “Repeats” to Monthly when adding an expense.
            </ThemedText>
          </View>
        }
      />

      <AddSpendingSheet
        visible={!!editRule}
        editRule={editRule}
        onClose={() => setEditRule(null)}
      />
    </View>
  );
}

/** Mirrors TransactionRow, with the schedule in place of the date. */
function RecurringRow({ rule }: { rule: RecurringRule }) {
  const category = CATEGORY_MAP[rule.category];
  return (
    <View style={styles.row}>
      <CategoryBadge category={category} />
      <View style={styles.rowText}>
        <ThemedText type="default" numberOfLines={1}>
          {rule.title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {category.label} · Monthly on the {formatDayOrdinal(rule.dayOfMonth)}
        </ThemedText>
      </View>
      <ThemedText type="smallBold" style={styles.amount}>
        {formatCurrency(rule.amount)}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: 1,
  },
  amount: {
    fontSize: 16,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  emptyHint: {
    textAlign: 'center',
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
