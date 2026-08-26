import { PagerView, type PagerViewRef } from '@expo/ui/community/pager-view';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddButton } from '@/components/add-button';
import { AddSpendingSheet } from '@/components/add-spending-sheet';
import { MonthHeader } from '@/components/month-header';
import { MonthPage } from '@/components/month-page';
import { ControlHeight, Spacing } from '@/constants/theme';
import { currentMonthKey, monthOptions } from '@/lib/spending';
import { useLedger } from '@/store/ledger';

export default function SpendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items } = useLedger();

  // Opens on the current month: it is always the last entry in the range.
  const [month, setMonth] = useState(currentMonthKey());
  const [sheetVisible, setSheetVisible] = useState(false);

  // The home-screen widget deep-links to ledger:///?add=1. getInitialURL
  // covers cold starts, the event covers taps while the app is alive; both
  // just open the sheet — already-open is a no-op.
  // The home-screen widget deep-links to ledger:///?add=1. The dev client
  // swallows raw Linking events, but expo-router still delivers the URL as
  // route params. Clearing the param afterwards lets the next tap re-fire.
  const params = useLocalSearchParams<{ add?: string }>();
  useEffect(() => {
    if (params.add === '1') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- responding to an external deep link, not derived state
      setSheetVisible(true);
    }
  }, [params.add]);
  // Clearing the param on close (never during mount — navigating before the
  // root layout mounts is a render error) lets the next widget tap re-fire.
  const closeSheet = () => {
    setSheetVisible(false);
    if (params.add) router.setParams({ add: '' });
  };
  const pagerRef = useRef<PagerViewRef>(null);

  const months = useMemo(() => monthOptions(items), [items]);
  const index = Math.max(months.indexOf(month), 0);

  // Storage hydration is async, so the pager first mounts with only the
  // current month. When earlier months load they are prepended, which silently
  // re-maps page positions (page 0 becomes the earliest month) while the pager
  // stays put. Re-sync it to the selected month whenever the page set changes.
  // Deliberately not keyed on `month`/`index`: month changes are already
  // synced by stepMonth/onPageSelected, and jumping there would cancel the
  // chevrons' slide animation.
  useEffect(() => {
    pagerRef.current?.setPageWithoutAnimation(index);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months.length]);

  const openAll = useCallback(() => router.push('/transactions'), [router]);
  const openCategory = useCallback(
    (category: string) => router.push({ pathname: '/transactions', params: { category } }),
    [router],
  );

  const stepMonth = (delta: number) => {
    const next = months[index + delta];
    if (!next) return;
    setMonth(next);
    pagerRef.current?.setPage(index + delta);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <MonthHeader
              month={month}
              canGoBack={index > 0}
              canGoForward={index < months.length - 1}
              onBack={() => stepMonth(-1)}
              onForward={() => stepMonth(1)}
            />
          ),
        }}
      />

      {/* A native pager (UIPageViewController) rather than a horizontal
          FlatList: each page holds a vertical ScrollView, and nesting those
          inside an RN horizontal scroll view desyncs scrolling. Swiping and
          the header chevrons drive the same pager. */}
      <PagerView
        ref={pagerRef}
        style={styles.pager}
        initialPage={index}
        onPageSelected={(e) => {
          const next = months[e.nativeEvent.position];
          if (next && next !== month) setMonth(next);
        }}>
        {months.map((key) => (
          <View key={key} collapsable={false} style={styles.page}>
            <MonthPage
              month={key}
              items={items}
              bottomPadding={ControlHeight + insets.bottom + Spacing.four}
              onOpenAll={openAll}
              onOpenCategory={openCategory}
            />
          </View>
        ))}
      </PagerView>

      <View style={[styles.addButton, { bottom: insets.bottom + Spacing.two }]}>
        <AddButton onPress={() => setSheetVisible(true)} />
      </View>

      <AddSpendingSheet visible={sheetVisible} onClose={closeSheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
  addButton: {
    position: 'absolute',
    right: Spacing.four,
  },
});
