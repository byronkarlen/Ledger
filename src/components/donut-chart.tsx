import Svg, { Circle, G } from 'react-native-svg';

export type DonutSlice = {
  value: number;
  color: string;
};

type Props = {
  slices: DonutSlice[];
  size: number;
  /** Ring thickness in points. */
  thickness?: number;
  /** Blank space between slices, in points along the ring. */
  gap?: number;
};

/**
 * Ring chart drawn with SVG rather than a native SwiftUI chart, so it scrolls
 * in lockstep with the rest of the page. A hosted SwiftUI view re-lays out
 * against its visible bounds inside a pager, which made it shrink and drift
 * away from the total overlaid on it.
 *
 * Each slice is one stroked circle whose dash pattern exposes only its own
 * arc, offset by the slices before it.
 */
export function DonutChart({ slices, size, thickness = 12, gap = 2 }: Props) {
  const center = size / 2;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total <= 0) return null;

  // A lone slice is a closed ring, not a circle with a notch cut out of it.
  const sliceGap = slices.length > 1 ? gap : 0;
  const arcs = slices.map((slice) => (slice.value / total) * circumference);
  // Each slice starts where the previous ones ended.
  const offsets = arcs.map((_, i) => arcs.slice(0, i).reduce((sum, arc) => sum + arc, 0));

  return (
    <Svg width={size} height={size}>
      {/* Start the first slice at twelve o'clock instead of three. */}
      <G rotation={-90} originX={center} originY={center}>
        {slices.map((slice, i) => {
          const drawn = Math.max(arcs[i] - sliceGap, 0.5);

          return (
            <Circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={thickness}
              strokeDasharray={`${drawn} ${circumference - drawn}`}
              strokeDashoffset={-offsets[i]}
            />
          );
        })}
      </G>
    </Svg>
  );
}
