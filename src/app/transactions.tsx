import { SymbolView } from 'expo-symbols';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Pressable,
  SectionList,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, {
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSpendingSheet } from '@/components/add-spending-sheet';
import { NativeSelect, type SelectOption } from '@/components/native-select';
import { ThemedText } from '@/components/themed-text';
import { RowSeparator, TransactionRow } from '@/components/transaction-row';
import { CATEGORY_OPTIONS, isCategoryKey, type CategoryKey } from '@/constants/categories';
import { Danger, Spacing, useTheme } from '@/constants/theme';
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
        // No exiting animation here: it can't tell a delete from a filter
        // change, so switching filters made every leaving row fly off. The
        // delete-only LayoutAnimation in SwipeableRow animates removal.
        renderItem={({ item }) => (
          <SwipeableRow
            item={item}
            onEdit={() => setEditItem(item)}
            onDelete={() => deleteItem(item.id)}
          />
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

/**
 * A transaction row with Reminders-style swipe-to-delete: while swiping, the
 * row becomes a grey capsule sliding away from a detached red "Delete"
 * capsule that stretches with the drag. Pulling past just over half the
 * screen commits the delete and the row flies off. Default friction (1) so
 * the row tracks the finger exactly.
 */
function SwipeableRow({
  item,
  onEdit,
  onDelete,
}: {
  item: SpendingItem;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const theme = useTheme();
  // Grey capsule background while the swipe is revealed, so the row reads as
  // an object sliding, not white-on-white.
  const [swiping, setSwiping] = useState(false);
  // Set on the UI thread while the drag is past the full-swipe threshold.
  const pastFullSwipe = useSharedValue(false);

  // Animates the remaining rows closing the gap after this one unmounts.
  const commitDelete = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    onDelete();
  };

  return (
    <ReanimatedSwipeable
      rightThreshold={40}
      // Undamped overshoot: the row keeps tracking the finger past the open
      // snap (like Reminders), which also lets the full-swipe threshold
      // actually be reached — the default friction of 8 caps the translation
      // near the snap point.
      overshootFriction={1}
      onSwipeableOpenStartDrag={() => setSwiping(true)}
      onSwipeableClose={() => setSwiping(false)}
      // Committing on release, not mid-drag: deleting while the finger is
      // still down let the touch fall through to the row that slid up
      // underneath, opening its edit sheet.
      onSwipeableWillOpen={() => {
        if (pastFullSwipe.value) commitDelete();
      }}
      renderRightActions={(_, translation) => (
        <DeleteAction
          translation={translation}
          pastFullSwipe={pastFullSwipe}
          onDelete={commitDelete}
        />
      )}>
      {/* The row must stay fully opaque, including while pressed — otherwise
          the red action bleeds through the moment a swipe's touch-down lands.
          Feedback is a background change, never opacity. */}
      <Pressable
        onPress={onEdit}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor:
              swiping || pressed ? theme.backgroundElement : theme.background,
          },
        ]}>
        <TransactionRow item={item} />
      </Pressable>
    </ReanimatedSwipeable>
  );
}

/** Width of the delete capsule at rest — also the swipe-open snap width. */
const DELETE_WIDTH = 104;
const DELETE_GAP = Spacing.two;

function DeleteAction({
  translation,
  pastFullSwipe,
  onDelete,
}: {
  translation: SharedValue<number>;
  pastFullSwipe: SharedValue<boolean>;
  onDelete: () => void;
}) {
  const { width: screenWidth } = useWindowDimensions();

  // Full swipe: pulling past just over half the screen arms the delete; the
  // release handler commits it, like Reminders.
  useAnimatedReaction(
    () => translation.value,
    (t) => {
      // A SharedValue prop is a mutable bridge by design; the lint rule
      // doesn't know reanimated.
      // eslint-disable-next-line react-hooks/immutability
      pastFullSwipe.value = t < -screenWidth * 0.55;
    },
  );

  // The capsule is anchored to the right edge and stretches leftward with
  // the drag, so an overshoot fills with red instead of empty background.
  const pillStyle = useAnimatedStyle(() => ({
    width: Math.max(DELETE_WIDTH, -translation.value - DELETE_GAP),
  }));

  return (
    // Fixed-width container: the swipeable measures its actions to pick the
    // open snap point, and the stretching capsule must not move it.
    <View style={styles.deleteSlot}>
      <Animated.View style={[styles.deletePill, pillStyle]}>
        <Pressable
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel="Delete"
          style={({ pressed }) => [
            styles.deletePress,
            pressed && styles.deletePressed,
          ]}>
          <SymbolView name="trash.fill" size={16} tintColor="#ffffff" />
          <ThemedText type="default" style={styles.deleteLabel}>
            Delete
          </ThemedText>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// Row height: 8pt vertical padding around the 40pt badge.
const ROW_CAPSULE_RADIUS = (40 + 2 * Spacing.two) / 2;

const styles = StyleSheet.create({
  container: { flex: 1 },
  sectionHeader: {
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  // Capsule shape, matching the swipe actions in Reminders. Content sits
  // slightly inset so the badge and amount clear the rounded ends.
  row: {
    borderRadius: ROW_CAPSULE_RADIUS,
    paddingHorizontal: Spacing.two,
  },
  deleteSlot: {
    width: DELETE_WIDTH + DELETE_GAP,
  },
  deletePill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    borderRadius: ROW_CAPSULE_RADIUS,
    overflow: 'hidden',
  },
  deletePress: {
    flex: 1,
    backgroundColor: Danger,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  // Darker red, not opacity: a translucent press would show the background
  // through the capsule.
  deletePressed: {
    backgroundColor: '#D70015',
  },
  deleteLabel: {
    color: '#ffffff',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: Spacing.six,
  },
});
