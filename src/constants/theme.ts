import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export function useTheme() {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

/** Brand accent, used for links and primary actions. */
export const Accent = '#3c87f7';

/** iOS system destructive red. */
export const Danger = '#FF3B30';

/** Uniform feedback opacity for pressed Pressables. */
export const PressedOpacity = 0.6;

/** Height of the floating controls in the bottom bar, so they match. */
export const ControlHeight = 52;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;
