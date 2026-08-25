import { Button, Circle, GlassEffectContainer, Host, HStack } from '@expo/ui/swift-ui';
import {
  buttonStyle,
  font,
  foregroundColor,
  frame,
  glassEffect,
  labelStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { Accent, ControlHeight, Colors } from '@/constants/theme';
import { type MonthKey } from '@/lib/spending';

const DOT = 7;

type Props = {
  months: MonthKey[];
  month: MonthKey;
  onSelectMonth: (month: MonthKey) => void;
  onAdd: () => void;
};

/**
 * Weather-style bar: a dots capsule beside a round add button, both built from
 * SwiftUI's `glassEffect` inside a `GlassEffectContainer` so they share one
 * material — and so their glass blends as they approach each other, which
 * separate `GlassView`s cannot do.
 *
 * Safe as a SwiftUI island because this bar is a fixed overlay: it never
 * scrolls, pages, or animates, which is where hosted SwiftUI misbehaves.
 */
export function BottomBar({ months, month, onSelectMonth, onAdd }: Props) {
  return (
    <Host matchContents>
      <GlassEffectContainer spacing={20}>
        <HStack spacing={12}>
          <HStack
            spacing={10}
            modifiers={[
              padding({ horizontal: 18, vertical: 16 }),
              glassEffect({ glass: { variant: 'regular' }, shape: 'capsule' }),
            ]}>
            {months.map((key) => (
              <Button
                key={key}
                onPress={() => onSelectMonth(key)}
                modifiers={[buttonStyle('plain')]}>
                <Circle
                  modifiers={[
                    frame({ width: DOT, height: DOT }),
                    foregroundColor(key === month ? Accent : Colors.light.textSecondary),
                  ]}
                />
              </Button>
            ))}
          </HStack>

          <Button
            label="Add"
            systemImage="plus"
            onPress={onAdd}
            modifiers={[
              labelStyle('iconOnly'),
              font({ size: 20, weight: 'semibold' }),
              // foregroundColor, not tint: on a real device `tint` colors the
              // glass material itself, which fills the circle pale blue. The
              // simulator doesn't render that, so it only shows on hardware.
              foregroundColor(Accent),
              frame({ width: 24, height: 24 }),
              padding({ all: 14 }),
              glassEffect({ glass: { variant: 'regular' }, shape: 'circle' }),
            ]}
          />
        </HStack>
      </GlassEffectContainer>
    </Host>
  );
}

export const BOTTOM_BAR_HEIGHT = ControlHeight;
