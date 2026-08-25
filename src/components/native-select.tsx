import { MenuView } from '@react-native-menu/menu';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Spacing, useTheme } from '@/constants/theme';

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /**
   * 'inline' renders an accent-colored value for use inside content rows;
   * 'title' renders like a navigation-bar title for use as a headerTitle.
   */
  appearance?: 'inline' | 'title';
  style?: StyleProp<ViewStyle>;
};

/**
 * Native single-choice pop-up button: an anchored UIMenu with a checkmark on
 * the current value. Uses @react-native-menu/menu, which attaches the menu to
 * a plain UIKit view — deliberately not a hosted-SwiftUI trigger (@expo/ui's
 * Picker and MenuView both mis-measured inside animating containers).
 */
export const NativeSelect = memo(function NativeSelect({
  label,
  options,
  value,
  onChange,
  appearance = 'inline',
  style,
}: Props) {
  const theme = useTheme();
  const selected = options.find((o) => o.value === value);
  const isTitle = appearance === 'title';

  return (
    <MenuView
      title={label}
      actions={options.map((o) => ({
        id: o.value,
        title: o.label,
        state: o.value === value ? ('on' as const) : ('off' as const),
      }))}
      onPressAction={({ nativeEvent }) => onChange(nativeEvent.event)}
      style={style}>
      <View
        style={styles.anchor}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label }}>
        <ThemedText type="default" style={isTitle ? styles.title : styles.accent}>
          {selected?.label ?? ''}
        </ThemedText>
        <SymbolView
          name="chevron.up.chevron.down"
          size={12}
          tintColor={isTitle ? theme.textSecondary : Accent}
          weight="semibold"
        />
      </View>
    </MenuView>
  );
});

const styles = StyleSheet.create({
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  accent: {
    color: Accent,
  },
  // Matches the native navigation-bar title (17pt semibold).
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
});
