// Not re-exported from expo-router's entry point, but the vendored copy of
// React Navigation ships it.
import { useHeaderHeight } from 'expo-router/build/react-navigation/elements';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from 'react-native';

import { DonutChart } from '@/components/donut-chart';
import { ThemedText } from '@/components/themed-text';
import { CategoryBadge, RowSeparator } from '@/components/transaction-row';
import { PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import {
  categoryBreakdown,
  formatCurrency,
  formatMonthName,
  itemsInMonth,
  sumAmounts,
  type MonthKey,
} from '@/lib/spending';
import type { SpendingItem } from '@/store/ledger';

const CHART_HEIGHT = 300;
const CHART_RADIUS = CHART_HEIGHT / 2;

// React Native hit-tests rectangles, so a round tap target needs its own
// check: did the touch land inside the donut, or merely in its bounding box?
function isInsideChart(e: GestureResponderEvent): boolean {
  const dx = e.nativeEvent.locationX - CHART_RADIUS;
  const dy = e.nativeEvent.locationY - CHART_RADIUS;
  return dx * dx + dy * dy <= CHART_RADIUS * CHART_RADIUS;
}

type Props = {
  month: MonthKey;
  items: SpendingItem[];
  bottomPadding: number;
  onOpenAll: () => void;
  onOpenCategory: (category: string) => void;
};

/** One swipeable page: the donut and category breakdown for a single month. */
export function MonthPage({ month, items, bottomPadding, onOpenAll, onOpenCategory }: Props) {
  const theme = useTheme();
  const headerHeight = useHeaderHeight();
  const [chartPressed, setChartPressed] = useState(false);

  const monthItems = useMemo(() => itemsInMonth(items, month), [items, month]);
  const breakdown = useMemo(() => categoryBreakdown(monthItems), [monthItems]);
  const total = useMemo(() => sumAmounts(monthItems), [monthItems]);

  const slices = useMemo(
    () => breakdown.map((b) => ({ value: b.amount, color: b.category.color })),
    [breakdown],
  );

  return (
    <ScrollView
      // Inside a pager the scroll view is no longer the screen's primary
      // one, so iOS won't inset it for the header automatically.
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{
        paddingTop: headerHeight + Spacing.two,
        paddingBottom: bottomPadding,
        gap: Spacing.four,
      }}
      showsVerticalScrollIndicator={false}>
      {total === 0 ? (
        <View style={styles.empty}>
          <SymbolView name="tray" size={44} tintColor={theme.textSecondary} />
          <ThemedText type="default" themeColor="textSecondary">
            No spending in {formatMonthName(month)}
          </ThemedText>
        </View>
      ) : (
        <>
          <View style={styles.chartWrap}>
            <DonutChart slices={slices} size={CHART_HEIGHT} />
            {/* Sits after the chart so it hit-tests first: the whole donut is
                the tap target, not just the total. Uses the responder system
                rather than Pressable because only that can decline a touch
                that landed in the corners outside the circle. */}
            <View
              style={[styles.chartTapArea, chartPressed && styles.pressed]}
              accessible
              accessibilityRole="button"
              accessibilityLabel="View all transactions"
              onAccessibilityTap={onOpenAll}
              onStartShouldSetResponder={isInsideChart}
              onResponderGrant={() => setChartPressed(true)}
              onResponderRelease={(e) => {
                setChartPressed(false);
                if (isInsideChart(e)) onOpenAll();
              }}
              onResponderTerminate={() => setChartPressed(false)}>
              {/* Touch-transparent: locationX/Y in the responder callbacks are
                  relative to the deepest view hit, so a tap landing on the
                  text would otherwise be measured in the text's own frame and
                  fail the circle check. */}
              <View pointerEvents="none" style={styles.chartLabel}>
                <ThemedText type="small" themeColor="textSecondary">
                  Total spend
                </ThemedText>
                <ThemedText style={styles.chartTotal}>{formatCurrency(total)}</ThemedText>
              </View>
            </View>
          </View>

          <View style={styles.breakdown}>
            {breakdown.map(({ category, amount, pct }, i) => (
              <Pressable
                key={category.key}
                onPress={() => onOpenCategory(category.key)}
                style={({ pressed }) => pressed && styles.pressed}>
                <View style={styles.breakdownRow}>
                  <CategoryBadge category={category} />
                  <View style={styles.breakdownText}>
                    <ThemedText type="default">{category.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {Math.round(pct)}% of spend
                    </ThemedText>
                  </View>
                  <ThemedText type="smallBold" style={styles.breakdownAmount}>
                    {formatCurrency(amount)}
                  </ThemedText>
                </View>
                {i < breakdown.length - 1 && <RowSeparator />}
              </Pressable>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.six,
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    height: CHART_HEIGHT,
    marginHorizontal: Spacing.four,
  },
  chartTapArea: {
    position: 'absolute',
    width: CHART_HEIGHT,
    height: CHART_HEIGHT,
    borderRadius: CHART_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chartLabel: {
    alignItems: 'center',
  },
  chartTotal: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 48,
    marginTop: Spacing.half,
  },
  breakdown: {
    paddingHorizontal: Spacing.four,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  breakdownText: {
    flex: 1,
    gap: 1,
  },
  breakdownAmount: {
    fontSize: 16,
  },
  pressed: {
    opacity: PressedOpacity,
  },
});
