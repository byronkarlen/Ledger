import { MenuView } from '@react-native-menu/menu';
import { SymbolView } from 'expo-symbols';
import { memo, type ReactNode } from 'react';
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
  /** Optional element shown before the value, e.g. a category badge. */
  icon?: ReactNode;
  /** Shown in place of the value while nothing is selected. */
  placeholder?: string;
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
  icon,
  placeholder,
  style,
}: Props) {
  const theme = useTheme();
  const selected = options.find((o) => o.value === value);
  const isTitle = appearance === 'title';

  // Note on the open animation: iOS 26 draws a liquid-glass bloom that grows
  // out of the anchor and refracts whatever sits under it (this title
  // included) for a few frames. That is the system menu animation — an empty
  // transparent anchor overlay was tried and changed nothing, confirming the
  // distortion is refraction, not a snapshot of the anchor content.
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
        {icon}
        {/* Same progression as a text field: grey placeholder while empty,
            primary text color once a value exists. The accent chevrons carry
            the tap affordance. */}
        <ThemedText
          type="default"
          style={isTitle ? styles.title : !selected && { color: theme.textSecondary }}>
          {selected?.label ?? placeholder ?? ''}
        </ThemedText>
        <SymbolView
          name="chevron.up.chevron.down"
          size={12}
          tintColor={Accent}
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
  // Matches the native navigation-bar title (17pt semibold).
  title: {
    fontSize: 17,
    fontWeight: '600',
  },
});
