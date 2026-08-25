import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetTextInput,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { SymbolView } from 'expo-symbols';
import { useCallback, useRef, useState, type ComponentRef } from 'react';
import { InputAccessoryView, Keyboard, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NativeSelect } from '@/components/native-select';
import { ThemedText } from '@/components/themed-text';
import { CATEGORY_OPTIONS, type CategoryKey } from '@/constants/categories';
import { Accent, Danger, PressedOpacity, Spacing, useTheme } from '@/constants/theme';
import { roundToCents } from '@/lib/spending';
import { useLedger, type SpendingItem } from '@/store/ledger';

const AMOUNT_FONT_SIZE = 32;
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

const AMOUNT_ACCESSORY_ID = 'amount-next';

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
  const [amount, setAmount] = useState(editItem ? String(editItem.amount) : '');
  const [category, setCategory] = useState<CategoryKey>(editItem?.category ?? 'grocery');

  const parsedAmount = parseFloat(amount);
  const canSave = title.trim().length > 0 && !isNaN(parsedAmount) && parsedAmount > 0;

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
    if (!canSave) return;
    const roundedAmount = roundToCents(parsedAmount);
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

        {/* Fixed-width box: the field never resizes as you type, so there is
            no layout change to flicker. */}
        <View style={styles.amountRow}>
          <Text style={[styles.currency, { color: theme.textSecondary }]}>$</Text>
          <BottomSheetTextInput
            ref={amountRef}
            autoFocus
            value={amount}
            onChangeText={(t) => setAmount(sanitizeAmount(t))}
            placeholder="0.00"
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            inputAccessoryViewID={AMOUNT_ACCESSORY_ID}
            style={[
              styles.field,
              styles.amountInput,
              { backgroundColor: theme.background, color: theme.text },
            ]}
          />
        </View>

        <BottomSheetTextInput
          ref={titleRef}
          value={title}
          onChangeText={setTitle}
          placeholder="Where did you spend?"
          placeholderTextColor={theme.textSecondary}
          style={[styles.field, { backgroundColor: theme.background, color: theme.text }]}
          returnKeyType="done"
          onSubmitEditing={() => Keyboard.dismiss()}
        />

        <View style={[styles.field, styles.categoryRow, { backgroundColor: theme.background }]}>
          <ThemedText type="default">Category</ThemedText>
          <NativeSelect
            label="Category"
            options={CATEGORY_OPTIONS}
            value={category}
            onChange={handleCategoryChange}
          />
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
    {/* The decimal pad has no return key, so give it a "Next" bar. */}
    <InputAccessoryView nativeID={AMOUNT_ACCESSORY_ID}>
      <View style={[styles.accessoryBar, { backgroundColor: theme.backgroundElement }]}>
        <Pressable onPress={() => titleRef.current?.focus()} hitSlop={8}>
          <ThemedText type="smallBold" style={{ color: Accent }}>
            Next
          </ThemedText>
        </Pressable>
      </View>
    </InputAccessoryView>
    </>
  );
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
  // No vertical padding: every gap in the sheet comes from the content
  // container's `gap`, so the rows stay evenly spaced.
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  currency: {
    fontSize: AMOUNT_FONT_SIZE,
    fontWeight: '700',
  },
  // Layered over `field`, so corner radius, padding and background stay in
  // step with the other inputs; only the amount-specific type differs.
  amountInput: {
    width: 200,
    paddingVertical: 0,
    fontSize: AMOUNT_FONT_SIZE,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
  },
  field: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    height: FIELD_HEIGHT,
    fontSize: 16,
    fontWeight: '500',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
    paddingRight: Spacing.two,
    minHeight: FIELD_HEIGHT,
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
