import { Button, GlassEffectContainer, Host } from '@expo/ui/swift-ui';
import {
  font,
  foregroundColor,
  frame,
  glassEffect,
  labelStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';

import { Accent } from '@/constants/theme';

type Props = {
  onPress: () => void;
};

/**
 * The screen's one primary action: a plain glass circle with a plus, pinned
 * bottom-right by the caller. Built with SwiftUI's glassEffect so it renders
 * Apple's real Liquid Glass material.
 *
 * Safe as a SwiftUI island because it is a fixed overlay: it never scrolls,
 * pages, or animates, which is where hosted SwiftUI misbehaves.
 * `foregroundColor`, not `tint`: on hardware, `tint` colors the glass material
 * itself and fills the circle pale blue.
 */
export function AddButton({ onPress }: Props) {
  return (
    <Host matchContents>
      <GlassEffectContainer>
        <Button
          label="Add"
          systemImage="plus"
          onPress={onPress}
          modifiers={[
            labelStyle('iconOnly'),
            font({ size: 20, weight: 'semibold' }),
            foregroundColor(Accent),
            frame({ width: 24, height: 24 }),
            padding({ all: 14 }),
            glassEffect({ glass: { variant: 'regular' }, shape: 'circle' }),
          ]}
        />
      </GlassEffectContainer>
    </Host>
  );
}
