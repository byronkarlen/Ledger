import { DarkTheme, DefaultTheme, ThemeProvider, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { useTheme, Colors } from '@/constants/theme';
import { LedgerProvider } from '@/store/ledger';

// Keep the native splash up until the root view has laid out, then let the
// OS fade it out over the rendered app.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ fade: true, duration: 300 });

export default function RootLayout() {
  const colors = useTheme();

  return (
    <GestureHandlerRootView style={{ flex: 1 }} onLayout={() => SplashScreen.hideAsync()}>
      <ThemeProvider value={colors === Colors.dark ? DarkTheme : DefaultTheme}>
        <LedgerProvider>
          <Stack
            screenOptions={{
              headerTransparent: true,
              scrollEdgeEffects: { top: 'hidden' },
              headerShadowVisible: false,
              contentStyle: { backgroundColor: colors.background },
            }}>
            <Stack.Screen name="index" options={{ title: 'Spending' }} />
            <Stack.Screen
              name="transactions"
              options={{ title: 'Expenses', headerBackButtonDisplayMode: 'minimal' }}
            />
            <Stack.Screen
              name="recurring"
              options={{ title: 'Recurring Expenses', headerBackButtonDisplayMode: 'minimal' }}
            />
          </Stack>
        </LedgerProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
