import { MenuView } from '@expo/ui/community/menu';
import { SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Accent, Spacing } from '@/constants/theme';

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * A native iOS dropdown. The menu itself is native, but its anchor is an
 * ordinary React Native row — a SwiftUI-hosted picker mis-anchors its content
 * whenever it lays out during an animation (sheet opening, keyboard sliding),
 * leaving the label floating above its row.
 */
export const NativeSelect = memo(function NativeSelect({
  label,
  options,
  value,
  onChange,
  style,
}: Props) {
  const selected = options.find((o) => o.value === value);

  return (
    <MenuView
      // Size the trigger to its content: left unset it stretches across the
      // row, and iOS draws the menu's press highlight over that full width.
      style={style}
      title={label}
      onPressAction={({ nativeEvent }) => onChange(nativeEvent.event)}
      actions={options.map((o) => ({
        id: o.value,
        title: o.label,
        state: o.value === value ? 'on' : 'off',
      }))}>
      <View style={styles.anchor}>
        <ThemedText type="default" style={styles.value}>
          {selected?.label ?? ''}
        </ThemedText>
        <SymbolView name="chevron.up.chevron.down" size={12} tintColor={Accent} weight="semibold" />
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
  value: {
    color: Accent,
  },
});
