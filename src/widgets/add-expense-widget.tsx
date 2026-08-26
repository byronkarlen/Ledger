import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  backgroundOverlay,
  containerRelativeFrame,
  cornerRadius,
  font,
  foregroundStyle,
  frame,
  padding,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type AddExpenseWidgetProps = {
  /** Formatted month-to-date total, e.g. "$2,116". */
  totalLabel?: string;
  /** Month the total covers, e.g. "August". */
  monthLabel?: string;
  /**
   * Category bar segments in display order. Spans are container-relative
   * units summing to ~90 of 100 (the widget's own width is the container,
   * and ~10 units approximates the card's horizontal padding).
   */
  segments?: { color: string; span: number }[];
};

/**
 * Full-width home-screen widget. Left: this month's spend over a slim
 * category-colored bar (the donut chart, flattened). Right: a plus button
 * that deep-links straight into the New Purchase sheet (?add=1). Tapping
 * anywhere else opens the app on the current month (plain widgetURL).
 * The store pushes fresh props via updateSnapshot on every ledger change.
 */
const AddExpenseWidget = (props: AddExpenseWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const primary = dark ? '#ffffff' : '#1b1d21';
  const secondary = dark ? '#a3a8b0' : '#63676e';
  // Inlined app accent: the 'widget' directive extracts only this function
  // into the widget bundle, so app-module imports don't exist at runtime.
  const accent = '#3c87f7';
  const segments = props.segments ?? [];
  return (
    <VStack
      modifiers={[
        widgetURL('ledger:///'),
        // iOS 17+ requires widgets to adopt containerBackground; the JS-level
        // modifier passed WidgetKit's check on the simulator but not on
        // hardware, so the native template applies it instead (patched in
        // patches/expo-widgets: systemBackground behind WidgetsEntryView).
        padding({ all: 16 }),
      ]}
      alignment="leading"
      spacing={0}>
      <Text modifiers={[font({ size: 14, weight: 'semibold' }), foregroundStyle(secondary)]}>
        {props.monthLabel ?? 'This month'}
      </Text>
      {/* The button shares a row with the total alone, so it centers on the
          number's line; SF Symbols at a font size match that text's optical
          height. */}
      <HStack alignment="center">
        <Text modifiers={[font({ size: 40, weight: 'bold' }), foregroundStyle(primary)]}>
          {props.totalLabel ?? '$0'}
        </Text>
        <Spacer />
        <Link destination="ledger:///?add=1">
          <Image systemName="plus.circle.fill" size={40} color={accent} />
        </Link>
      </HStack>
      <Spacer />
      {segments.length > 0 && (
        <HStack spacing={2}>
          {segments.map((s, i) => (
            <HStack
              key={i}
              modifiers={[
                containerRelativeFrame({ axes: 'horizontal', count: 100, span: s.span, spacing: 2 }),
                frame({ height: 6 }),
                backgroundOverlay({ color: s.color }),
                cornerRadius(3),
              ]}>
              <Spacer />
            </HStack>
          ))}
          <Spacer />
        </HStack>
      )}
    </VStack>
  );
};

export default createWidget('AddExpense', AddExpenseWidget);
