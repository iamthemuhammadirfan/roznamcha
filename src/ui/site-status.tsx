// The top of Settings (SiteStatus): an identity card with the sync state, and the
// pieces the pages it opens share — the readout stage under their header, and the
// laser-level line that draws an update's download progress.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { Fragment, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { isUrdu } from '@/i18n';

import { Num, T } from './text';
import { colors, space } from './theme';

export type SyncState = 'saved' | 'pending' | 'offline';


// The sweep starts once the tab switch has settled, so it is actually seen, and eases
// out like a beam reaching the walls. Hoisted so a focus doesn't rebuild them.
const SWEEP = { duration: 1400, easing: Easing.out(Easing.quad) };
const SWEEP_DELAY = 180;
const PROGRESS = { duration: 250, easing: Easing.linear };

/**
 * 0 → 1 each time the screen comes into view, on the UI thread. Tab screens stay
 * mounted, so a sweep on mount alone would play once, unseen, at launch. Leaving resets
 * it, so coming back never flashes a full beam first.
 */
export function useSweep() {
  const reduceMotion = useReducedMotion();
  const sweep = useSharedValue(reduceMotion ? 1 : 0);
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion) {
        sweep.set(1);
        return;
      }
      sweep.set(withDelay(SWEEP_DELAY, withTiming(1, SWEEP)));
      return () => {
        cancelAnimation(sweep);
        sweep.set(0);
      };
    }, [reduceMotion, sweep]),
  );
  return sweep;
}

/** A download's 0–1 progress, gliding between the updates expo-updates reports. */
export function useProgress(progress: number) {
  const value = useSharedValue(progress);
  useEffect(() => {
    value.set(withTiming(progress, PROGRESS));
  }, [progress, value]);
  return value;
}

/** A laser-level beam, drawn to `scale` (0–1) of its width, growing away from `from`. */
export function LaserLine({
  color,
  scale,
  from = 'start',
}: {
  color: string;
  scale: SharedValue<number>;
  from?: 'start' | 'end';
}) {
  // Only a transform changes per frame: no layout, no React render, and the glow isn't
  // redrawn — the view is scaled as a whole.
  const beam = useAnimatedStyle(() => ({ transform: [{ scaleX: scale.get() }] }));
  // transformOrigin is physical, and forced RTL doesn't mirror it: map start/end by hand.
  const fromLeft = (from === 'start') !== isUrdu;
  return (
    <Animated.View
      style={[
        {
          height: 2,
          backgroundColor: color,
          // Glow, so the line reads as light rather than paint.
          boxShadow: `0 0 10px 1px ${color}`,
          transformOrigin: fromLeft ? 'left' : 'right',
        },
        beam,
      ]}
    />
  );
}

const DOT = { saved: 'owed', pending: 'pending', offline: 'muted' } as const satisfies Record<SyncState, keyof typeof colors>;
const TINT = { saved: 'owedSoft', pending: 'pendingSoft', offline: 'bg' } as const satisfies Record<SyncState, keyof typeof colors>;
const PULSE = { duration: 1600, easing: Easing.out(Easing.quad) };

/**
 * The status dot and its ripple: the screen's only motion, and it means something.
 * Saved: two ripples each time the screen comes into view, then still. Uploading: a
 * steady pulse until the queue is empty. Offline: no motion — nothing is happening.
 */
function Pulse({ state }: { state: SyncState }) {
  const reduceMotion = useReducedMotion();
  const p = useSharedValue(0);
  useFocusEffect(
    useCallback(() => {
      if (reduceMotion || state === 'offline') return;
      p.set(0);
      p.set(withDelay(SWEEP_DELAY, withRepeat(withTiming(1, PULSE), state === 'pending' ? -1 : 2, false)));
      return () => {
        cancelAnimation(p);
        p.set(0);
      };
    }, [reduceMotion, state, p]),
  );
  const ring = useAnimatedStyle(() => ({
    opacity: p.get() === 0 ? 0 : 0.5 * (1 - p.get()),
    transform: [{ scale: 1 + p.get() * 1.6 }],
  }));
  const color = colors[DOT[state]];
  return (
    <View style={styles.pulse}>
      <Animated.View style={[styles.ripple, { backgroundColor: color }, ring]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

/**
 * The top of Settings: whose phone this is and whether its data is safe, on one card.
 * The badge speaks the same language as the "entered by" line on entries — green with a
 * tie for the owner, site yellow with a hard hat for a munshi.
 */
export function SiteStatus({
  business,
  name,
  role,
  owner,
  email,
  sync,
  readouts,
}: {
  business: string;
  /** The signed-in member's own name, when they have one. */
  name?: string | null;
  role: string;
  owner: boolean;
  email?: string | null;
  /** Absent in local mode: nothing syncs. */
  sync?: { state: SyncState; label: string; count?: number; hint?: string };
  /** Small readouts along the foot: a label beside its value. */
  readouts: Readout[];
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <View style={styles.who}>
          <View style={[styles.badge, { backgroundColor: owner ? colors.brand : colors.site }]}>
            <MaterialCommunityIcons
              name={owner ? 'account-tie' : 'account-hard-hat'}
              size={30}
              color={owner ? colors.white : colors.siteInk}
            />
          </View>
          <View style={{ flex: 1 }}>
            {/* Stretched: shrink-wrapped Nastaliq gets its last word dropped on Android. */}
            <T variant="h1" style={styles.stretch}>
              {business}
            </T>
            <View style={styles.identity}>
              {name ? <T variant="bodyBold">{name}</T> : null}
              <View style={[styles.role, { backgroundColor: owner ? colors.brandSoft : colors.pendingSoft }]}>
                <T variant="small" style={{ color: owner ? colors.brand : colors.siteInk }}>
                  {role}
                </T>
              </View>
            </View>
            {email ? (
              <Num numberOfLines={1} style={styles.email}>
                {email}
              </Num>
            ) : null}
          </View>
        </View>

        {sync ? (
          <View
            style={[styles.sync, { backgroundColor: colors[TINT[sync.state]] }]}
            accessibilityLiveRegion="polite"
            accessibilityLabel={sync.count ? `${sync.count} ${sync.label}` : sync.label}>
            <Pulse state={sync.state} />
            <View style={{ flex: 1 }}>
              <View style={styles.syncLine}>
                {sync.count ? (
                  <Num bold style={[styles.count, { color: colors[DOT[sync.state]] }]}>
                    {sync.count}
                  </Num>
                ) : null}
                <T variant="bodyBold" style={[styles.stretchRow, { color: sync.state === 'offline' ? colors.text : colors[DOT[sync.state]] }]}>
                  {sync.label}
                </T>
              </View>
              {sync.hint ? <T variant="small">{sync.hint}</T> : null}
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          {readouts.map((r) => (
            <View key={r.label} style={styles.footItem}>
              <T variant="small">{r.label}</T>
              <Num style={styles.footValue}>{r.value}</Num>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export interface Readout {
  label: string;
  value: string;
}

/** Instrument readouts: each a value over its label, divided by thin rules. */
function Readouts({ readouts }: { readouts: Readout[] }) {
  return (
    <View style={styles.readouts}>
      {readouts.map((r, i) => (
        <Fragment key={r.label}>
          {i > 0 ? <View style={styles.rule} /> : null}
          <View style={styles.readout}>
            <Num bold style={styles.readoutValue}>
              {r.value}
            </Num>
            <T variant="small" style={[styles.onBrand, styles.readoutLabel]}>
              {r.label}
            </T>
          </View>
        </Fragment>
      ))}
    </View>
  );
}

/** The stage for the pages Settings opens: just the readouts, continuing the header. */
export function ListStage({ readouts }: { readouts: Readout[] }) {
  return (
    <View style={styles.listStage}>
      <Readouts readouts={readouts} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, paddingTop: space.lg },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.md,
  },
  who: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  stretch: { alignSelf: 'stretch' },
  stretchRow: { flex: 1 },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  role: { borderRadius: 999, paddingHorizontal: space.md },
  email: { fontSize: 14, lineHeight: 24, color: colors.muted },
  sync: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 12,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  syncLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  count: { fontSize: 20, lineHeight: 30 },
  pulse: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  ripple: { position: 'absolute', width: 14, height: 14, borderRadius: 7 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  footer: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg },
  footItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  footValue: { fontSize: 14, lineHeight: 24, color: colors.text },
  onBrand: { color: colors.brandSoft },
  readouts: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: space.lg },
  rule: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.18)' },
  readout: { flex: 1, alignItems: 'center', paddingHorizontal: space.sm },
  readoutValue: { color: colors.white, fontSize: 18, lineHeight: 28 },
  readoutLabel: { textAlign: 'center', alignSelf: 'stretch' },
  listStage: { backgroundColor: colors.brand, paddingTop: space.xs, paddingBottom: space.lg },
});
