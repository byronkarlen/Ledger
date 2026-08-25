import { useRouter } from 'expo-router';
import { PagerView, type PagerViewRef } from '@expo/ui/community/pager-view';
import { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AddSpendingSheet } from '@/components/add-spending-sheet';
import { BottomBar } from '@/components/bottom-bar';
import { MonthPage } from '@/components/month-page';
import { ControlHeight, Spacing } from '@/constants/theme';
import { currentMonthKey, monthOptions, type MonthKey } from '@/lib/spending';
import { useLedger } from '@/store/ledger';

export default function SpendingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items } = useLedger();

  const [month, setMonth] = useState(currentMonthKey());
  const [sheetVisible, setSheetVisible] = useState(false);
  const pagerRef = useRef<PagerViewRef>(null);

  const months = useMemo(() => monthOptions(items), [items]);
  const index = Math.max(months.indexOf(month), 0);

  const openAll = useCallback(() => router.push('/transactions'), [router]);
  const openCategory = useCallback(
    (category: string) => router.push({ pathname: '/transactions', params: { category } }),
    [router],
  );

  const jumpToMonth = (next: MonthKey) => {
    setMonth(next);
    pagerRef.current?.setPage(months.indexOf(next));
  };

  return (
    <View style={styles.container}>
      {/* A native pager (UIPageViewController) rather than a horizontal
          FlatList: each page holds a vertical ScrollView with a SwiftUI chart
          in it, and nesting those inside an RN horizontal scroll view makes
          the native chart lag behind the rest of the page while scrolling. */}
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

      {/* Weather's bottom bar: a dots capsule centered between edge buttons.
          Floats over the pages rather than sitting on an opaque strip. */}
      <View
        style={[styles.bottomBar, { bottom: insets.bottom + Spacing.two }]}
        pointerEvents="box-none">
        <BottomBar
          months={months}
          month={month}
          onSelectMonth={jumpToMonth}
          onAdd={() => setSheetVisible(true)}
        />
      </View>

      <AddSpendingSheet visible={sheetVisible} onClose={() => setSheetVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  pager: { flex: 1 },
  page: { flex: 1 },
  bottomBar: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    alignItems: 'center',
  },
});
