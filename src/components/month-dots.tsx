import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Pressable, StyleSheet, View } from 'react-native';

import { Accent, ControlHeight, Spacing, useTheme } from '@/constants/theme';
import { formatMonthLong, type MonthKey } from '@/lib/spending';

// Fixed device capability; no need to re-query per render.
const HAS_GLASS = isLiquidGlassAvailable();

const DOT_SIZE = 7;
/** Touch target around each dot; the dot itself is far too small to hit. */
const DOT_HIT = 22;

type Props = {
  months: MonthKey[];
  month: MonthKey;
  onChange: (month: MonthKey) => void;
};

/**
 * Weather-style page indicator: a glass capsule of dots, one per month, with
 * the visible month filled in. Swiping the pages is the primary interaction;
 * the dots are also tappable for jumping.
 */
export function MonthDots({ months, month, onChange }: Props) {
  const theme = useTheme();

  const dots = (
    <View style={styles.row}>
      {months.map((key) => {
        const active = key === month;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={formatMonthLong(key)}
            style={styles.hit}>
            <View
              style={[
                styles.dot,
                { backgroundColor: active ? Accent : theme.textSecondary },
                !active && styles.inactive,
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );

  return HAS_GLASS ? (
    <GlassView glassEffectStyle="regular" style={styles.capsule}>
      {dots}
    </GlassView>
  ) : (
    <View style={[styles.capsule, { backgroundColor: theme.backgroundElement }]}>{dots}</View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    height: ControlHeight,
    borderRadius: ControlHeight / 2,
    overflow: 'hidden',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  hit: {
    width: DOT_HIT,
    height: DOT_HIT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
  inactive: {
    opacity: 0.35,
  },
});
