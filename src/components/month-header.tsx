import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import { formatMonthLong, type MonthKey } from '@/lib/spending';

type Props = {
  month: MonthKey;
  canGoBack: boolean;
  canGoForward: boolean;
  onBack: () => void;
  onForward: () => void;
};

/**
 * Navigation-bar title for the Spending screen: the visible month with
 * stepper chevrons, in the Calendar/Health style of titling a screen by the
 * period it shows. Rendered as the native header's title view.
 */
export function MonthHeader({ month, canGoBack, canGoForward, onBack, onForward }: Props) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        disabled={!canGoBack}
        accessibilityRole="button"
        accessibilityLabel="Previous month"
        hitSlop={12}
        style={({ pressed }) => [pressed && styles.pressed, !canGoBack && styles.disabled]}>
        <SymbolView name="chevron.left" size={17} tintColor={theme.text} weight="semibold" />
      </Pressable>

      <ThemedText style={styles.label}>{formatMonthLong(month)}</ThemedText>

      <Pressable
        onPress={onForward}
        disabled={!canGoForward}
        accessibilityRole="button"
        accessibilityLabel="Next month"
        hitSlop={12}
        style={({ pressed }) => [pressed && styles.pressed, !canGoForward && styles.disabled]}>
        <SymbolView name="chevron.right" size={17} tintColor={theme.text} weight="semibold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  // Fixed width so the chevrons don't shift as month names change length.
  label: {
    fontSize: 17,
    fontWeight: '600',
    minWidth: 132,
    textAlign: 'center',
  },
  pressed: {
    opacity: PressedOpacity,
  },
  disabled: {
    opacity: 0.25,
  },
});
