// The look of a construction-site signboard: a strip of hazard tape along the top and
// the project number on a yellow plate. Used for project cards on Home and the
// project header, so a project always looks like the board at its gate.
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';

import { Num } from './text';
import { colors, space } from './theme';

const STRIPE_HEIGHT = 10;
const BAR = 12;
// Enough bars to cover the widest phone; the strip clips the rest.
const BARS = Array.from({ length: 40 }, (_, i) => i);

export function HazardStripe() {
  return (
    <View style={styles.stripe} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {BARS.map((i) => (
        <View key={i} style={[styles.bar, { start: i * BAR * 2 - BAR }]} />
      ))}
    </View>
  );
}

export function CodePlate({ code, size = 24 }: { code: string; size?: number }) {
  return (
    <View style={styles.plate}>
      <Num bold style={{ fontSize: size, lineHeight: size * 1.4, color: colors.siteInk }}>
        {code}
      </Num>
    </View>
  );
}

export function SiteBoard({
  children,
  onPress,
  selected,
  muted,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** The active project gets a heavier frame. */
  selected?: boolean;
  /** Closed projects lose the tape. */
  muted?: boolean;
  style?: ViewStyle;
}) {
  const frame = [styles.board, selected && styles.selected, style];
  const body = (
    <>
      {muted ? null : <HazardStripe />}
      <View style={styles.body}>{children}</View>
    </>
  );
  if (!onPress) return <View style={frame}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [...frame, pressed && { backgroundColor: colors.brandSoft }]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  board: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  selected: { borderColor: colors.brand, borderWidth: 2 },
  body: { padding: space.lg, gap: space.sm },
  stripe: { height: STRIPE_HEIGHT, backgroundColor: colors.site, overflow: 'hidden' },
  bar: {
    position: 'absolute',
    top: -STRIPE_HEIGHT,
    width: BAR,
    height: STRIPE_HEIGHT * 3,
    backgroundColor: colors.siteInk,
    transform: [{ rotate: '45deg' }],
  },
  plate: {
    backgroundColor: colors.site,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.siteInk,
    paddingHorizontal: space.sm,
    minWidth: 56,
    alignItems: 'center',
  },
});
