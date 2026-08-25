import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { ActionSheetIOS, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, PressedOpacity, Spacing } from '@/constants/theme';

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Native single-choice picker: a plain RN trigger that presents an iOS action
 * sheet. Deliberately not a SwiftUI menu — every hosted-SwiftUI trigger tried
 * here (Picker, MenuView) mis-measured inside animating containers, painting
 * a stray highlight band across the row on hardware. An action sheet has no
 * hosted views, so there is nothing to mis-measure.
 */
export const NativeSelect = memo(function NativeSelect({
  label,
  options,
  value,
  onChange,
  style,
}: Props) {
  const selected = options.find((o) => o.value === value);

  const open = () => {
    const labels = options.map((o) => o.label);
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: label,
        options: [...labels, 'Cancel'],
        cancelButtonIndex: labels.length,
        disabledButtonIndices: [],
      },
      (chosen) => {
        if (chosen < labels.length) onChange(options[chosen].value);
      },
    );
  };

  return (
    <Pressable
      onPress={open}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityValue={{ text: selected?.label }}
      hitSlop={8}
      style={({ pressed }) => [styles.anchor, style, pressed && { opacity: PressedOpacity }]}>
      <ThemedText type="default" style={styles.value}>
        {selected?.label ?? ''}
      </ThemedText>
      <SymbolView name="chevron.up.chevron.down" size={12} tintColor={Accent} weight="semibold" />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  anchor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
  },
  value: {
    color: Accent,
  },
});
