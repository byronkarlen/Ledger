import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import { Keyboard, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeSelect } from '@/components/native-select';
import { ThemedText } from '@/components/themed-text';
import { CATEGORY_OPTIONS, type CategoryKey } from '@/constants/categories';
import { Accent, Danger, PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import { useLedger, type SpendingItem } from '@/store/ledger';

/** Shared height for every input row, so they line up. */
const FIELD_HEIGHT = 52;

// Keep only what makes sense as a price: digits, one decimal separator, at
// most two decimals, and a sane integer length. The decimal pad already
// restricts on-screen input; this also covers hardware keyboards and pastes
// (and strips the "$" the field displays).
function sanitizeAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.,]/g, '').replace(/,/g, '.');
  const [integer, ...decimals] = cleaned.split('.');
  const cappedInteger = integer.slice(0, 7);
  if (decimals.length === 0) return cappedInteger;
  return `${cappedInteger}.${decimals.join('').slice(0, 2)}`;
}

type Props = {
  visible: boolean;
  onClose: () => void;
  /** When provided, the sheet edits this item instead of creating a new one. */
  editItem?: SpendingItem | null;
};

/**
 * The sheet lives inside a transparent RN Modal so its backdrop dims the whole
 * window, including the native stack header, which sits above anything
 * rendered inside the screen itself. (A screens FullWindowOverlay would also
 * cover the header, but SwiftUI views from @expo/ui do not work in it.)
 * The Modal unmounts its content on close, so the form resets by construction
 * and the keyboard dismisses with it.
 */
export function AddSpendingSheet({ visible, onClose, editItem }: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onClose}>
      {/* Gestures don't cross into a modal's native view hierarchy, so the
          sheet needs its own gesture root. */}
      <GestureHandlerRootView style={styles.host}>
        <SheetContent onClose={onClose} editItem={editItem} />
      </GestureHandlerRootView>
    </Modal>
  );
}

function SheetContent({ onClose, editItem }: Omit<Props, 'visible'>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const { addItem, updateItem, deleteItem } = useLedger();
  const isEditing = !!editItem;
  const sheetRef = useRef<BottomSheet>(null);
  const amountRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  const titleRef = useRef<ComponentRef<typeof BottomSheetTextInput>>(null);
  // The sheet occasionally settles closed during its mount animation (a
  // layout race with dynamic sizing inside the Modal). Track whether it has
  // actually opened so that spurious early "close" can be retried instead of
  // tearing down the Modal.
  const hasOpened = useRef(false);

  // Mounts fresh on every open, so initializers read the target item directly.
  const [title, setTitle] = useState(editItem?.title ?? '');
  // Whole dollars everywhere; rounding here also cleans up any older
  // cent-precision data on its way through an edit.
  const [amount, setAmount] = useState(editItem ? String(Math.round(editItem.amount)) : '');
  // New items start with no category: a silently wrong default would flow
  // straight into the chart, so the save button waits for a deliberate pick.
  const [category, setCategory] = useState<CategoryKey | null>(editItem?.category ?? null);
  // Drives the custom caret next to the rendered hero amount.
  const [amountFocused, setAmountFocused] = useState(false);

  const parsedAmount = parseFloat(amount);
  const canSave =
    title.trim().length > 0 && !isNaN(parsedAmount) && parsedAmount > 0 && category !== null;

  // Buttons close via the sheet so the slide-down animation plays; the sheet's
  // onClose then hides the Modal.
  const close = () => sheetRef.current?.close();

  function handleClose() {
    if (!hasOpened.current) {
      sheetRef.current?.snapToIndex(0);
      return;
    }
    onClose();
  }

  function handleSave() {
    if (!canSave || !category) return;
    // Whatever gets typed, only whole dollars are stored and summed.
    const roundedAmount = Math.round(parsedAmount);
    if (editItem) {
      updateItem({ ...editItem, title: title.trim(), amount: roundedAmount, category });
    } else {
      addItem({
        title: title.trim(),
        amount: roundedAmount,
        category,
        date: new Date().toISOString(),
      });
    }
    close();
  }

  function handleDelete() {
    if (editItem) deleteItem(editItem.id);
    close();
  }

  // Stable handler so the memoized NativeSelect skips re-rendering on keystrokes.
  const handleCategoryChange = useCallback((v: string) => setCategory(v as CategoryKey), []);

  const handleAmountChange = (t: string) => {
    const sanitized = sanitizeAmount(t);
    setAmount(sanitized);
    // Two decimal digits complete a price. Hand focus to the title
    // immediately, before a third keystroke can bounce off the sanitizer
    // and flicker.
    if (/\.\d\d$/.test(sanitized)) titleRef.current?.focus();
  };

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} pressBehavior="close" />
    ),
    [],
  );

  return (
    <>
    <BottomSheet
      ref={sheetRef}
      // Dynamic sizing: the sheet hugs its content, and "interactive" lifts
      // it above the keyboard as it appears and disappears.
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      onChange={(index) => {
        if (index >= 0) hasOpened.current = true;
      }}
      // Dismiss the keyboard the moment any close starts (buttons, backdrop
      // tap, or pan-down) instead of when the Modal unmounts.
      onAnimate={(_from, to) => {
        if (to === -1) Keyboard.dismiss();
      }}
      onClose={handleClose}
      enablePanDownToClose
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      // Large top radius, matching how iOS 26 sheets mirror the display's
      // corner curve instead of a small card radius.
      backgroundStyle={{ backgroundColor: theme.backgroundElement, borderRadius: 38 }}
      handleIndicatorStyle={{ backgroundColor: theme.backgroundSelected }}>
      <BottomSheetView style={[styles.content, { paddingBottom: insets.bottom + Spacing.four }]}>
        <View style={styles.header}>
          <Pressable
            onPress={close}
            hitSlop={8}
            accessibilityLabel="Cancel"
            style={[styles.circleButton, { backgroundColor: theme.background }]}>
            <SymbolView name="xmark" size={16} tintColor={theme.textSecondary} weight="semibold" />
          </Pressable>
          <ThemedText style={styles.headerTitle}>
            {isEditing ? 'Edit Purchase' : 'New Purchase'}
          </ThemedText>
          <Pressable
            onPress={handleSave}
            hitSlop={8}
            disabled={!canSave}
            accessibilityLabel="Save"
            style={[
              styles.circleButton,
              { backgroundColor: canSave ? Accent : theme.background },
            ]}>
            <SymbolView
              name="checkmark"
              size={16}
              tintColor={canSave ? '#ffffff' : theme.textSecondary}
              weight="semibold"
            />
          </Pressable>
        </View>

        {/* Hero amount, payment-app style: the visible "$5" is a plain
            rendered Text, and keystrokes land in an invisible input
            behind it. A visible native field echoes every edit one frame
            before React confirms it — the $ popping in with the first
            digit, vanishing on backspace-at-empty, color flashing — while
            a rendered Text changes the $, the digits, and the grey→black
            color in one atomic commit, and backspace on empty changes
            nothing at all. The input takes no touches; the Pressable
            focuses it, which puts the caret at the end. */}
        <Pressable
          onPress={() => amountRef.current?.focus()}
          accessibilityLabel="Amount"
          style={styles.heroRow}>
          <Text
            style={[
              styles.heroAmount,
              { color: amount === '' ? theme.backgroundSelected : theme.text },
            ]}>
            ${amount}
          </Text>
          {amountFocused && <BlinkingCaret />}
          <BottomSheetTextInput
            ref={amountRef}
            autoFocus={!isEditing}
            value={amount}
            onChangeText={handleAmountChange}
            onFocus={() => setAmountFocused(true)}
            onBlur={() => setAmountFocused(false)}
            keyboardType="decimal-pad"
            caretHidden
            pointerEvents="none"
            style={styles.hiddenInput}
          />
        </Pressable>
        <View style={styles.labeledField}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caption}>
            For
          </ThemedText>
          <BottomSheetTextInput
            ref={titleRef}
            value={title}
            onChangeText={setTitle}
            placeholder="What was it for?"
            placeholderTextColor={theme.textSecondary}
            style={[styles.fieldBox, styles.titleInput, { backgroundColor: theme.background, color: theme.text }]}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>
        <View style={styles.labeledField}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.caption}>
            Category
          </ThemedText>
          <View style={[styles.fieldBox, styles.categorySelectRow, { backgroundColor: theme.background }]}>
            <NativeSelect
              label="Category"
              placeholder="Choose"
              options={CATEGORY_OPTIONS}
              value={category ?? ''}
              onChange={handleCategoryChange}
            />
          </View>
        </View>

        {isEditing && (
          <Pressable
            onPress={handleDelete}
            style={({ pressed }) => [styles.deleteButton, pressed && { opacity: PressedOpacity }]}>
            <SymbolView name="trash" size={16} tintColor={Danger} />
            <ThemedText type="smallBold" style={styles.deleteLabel}>
              Delete Purchase
            </ThemedText>
          </Pressable>
        )}
      </BottomSheetView>
    </BottomSheet>
    </>
  );
}

/** The hero amount renders as plain Text, so it needs its own caret. */
function BlinkingCaret() {
  const opacity = useSharedValue(1);
  useEffect(() => {
    // iOS-style blink: quick fades, roughly half a second per phase.
    opacity.value = withRepeat(
      withSequence(
        withDelay(450, withTiming(0, { duration: 120 })),
        withDelay(320, withTiming(1, { duration: 120 })),
      ),
      -1,
    );
  }, [opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[styles.caret, style]} />;
}

const styles = StyleSheet.create({
  host: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  circleButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // --- Variant A: caption over each field ---
  labeledField: {
    gap: Spacing.one,
  },
  caption: {
    marginLeft: Spacing.one,
  },
  fieldBox: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
  },
  categorySelectRow: {
    justifyContent: 'center',
  },
  // --- Variant C: borderless hero amount ---
  heroAmount: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  // Sized to the digits, not the full line: at 48pt a line-height caret
  // looms over the number.
  caret: {
    width: 3,
    height: 38,
    borderRadius: 1.5,
    backgroundColor: Accent,
  },
  hiddenInput: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  titleInput: {
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
    paddingVertical: Spacing.two,
  },
  deleteLabel: {
    color: Danger,
    fontSize: 16,
  },
});
