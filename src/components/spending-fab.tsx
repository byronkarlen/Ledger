import { Button, Host } from '@expo/ui/swift-ui';
import {
  buttonBorderShape,
  buttonStyle,
  controlSize,
  font,
  labelStyle,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { isLiquidGlassAvailable } from 'expo-glass-effect';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet } from 'react-native';

import { Accent, ControlHeight, useTheme } from '@/constants/theme';

// Fixed device capability; no need to re-query per render.
const HAS_GLASS = isLiquidGlassAvailable();

// Outer circle, matched to the native nav-bar buttons. The glass background
// wraps the padded glyph, so the circle is glyph + padding on each side.
const BUTTON_SIZE = ControlHeight;
const GLYPH_SIZE = 17;

type Props = {
  onPress: () => void;
};

/**
 * Round "+" button sized and styled to match the month capsule beside it.
 * On iOS 26+ it is a native SwiftUI glass button — unlike a GlassView, it
 * handles its own touches, so it gets the real glass shimmer and press
 * bounce. Positioning is the caller's job.
 */
export function SpendingFab({ onPress }: Props) {
  const theme = useTheme();

  return (
    <>
      {HAS_GLASS ? (
        // The host gets an explicit size and the SwiftUI button fills it, so
        // the visible circle, the measured box, and the tap target are the
        // same 56pt square. (matchContents measures asynchronously and can
        // leave the hit area smaller than the drawn glass.)
        <Host style={styles.glassButton}>
          <Button
            label="Add"
            systemImage="plus"
            onPress={onPress}
            modifiers={[
              // Order matters: the label is sized first, then the glass
              // background is drawn around it. Applying frame() after
              // buttonStyle() would leave a small circle inside a big box.
              labelStyle('iconOnly'),
              font({ size: GLYPH_SIZE, weight: 'medium' }),
              controlSize('large'),
              // Plain glass, matching the month capsule beside it — on a
              // non-prominent button the tint colors the glyph, not the fill.
              buttonStyle('glass'),
              tint(Accent),
              buttonBorderShape('circle'),
            ]}
          />
        </Host>
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityLabel="Add"
          style={({ pressed }) => [
            styles.solidCircle,
            { backgroundColor: theme.backgroundElement },
            pressed && styles.pressed,
          ]}>
          <SymbolView name="plus" size={GLYPH_SIZE} tintColor={Accent} weight="semibold" />
        </Pressable>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  glassButton: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Fallback for platforms without liquid glass.
  solidCircle: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.97 }],
  },
});
