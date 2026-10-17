// The top of Settings: a full-width stage that continues the header, with who this
// phone belongs to and whether its data is safe. At its centre, a laser level: an
// emitter whose beam runs to both edges, coloured by the sync state.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useFocusEffect } from 'expo-router';
import { Fragment, type ReactNode, useCallback, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { isUrdu } from '@/i18n';

import { type IconName } from './settings-list';
import { Num, T } from './text';
import { colors, space } from './theme';

export type SyncState = 'saved' | 'pending' | 'offline';

// Offline is a dim beam, not an alarm: entries are kept on the phone and upload later.
const BEAM = { saved: 'laser', pending: 'site', offline: 'muted' } as const satisfies Record<SyncState, keyof typeof colors>;
const CORE_ICON: Record<SyncState, IconName> = { saved: 'check', pending: 'arrow-up', offline: 'cloud-off-outline' };

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

/** The emitter: a lit core inside two rings, with the beam leaving both sides. */
function Level({ state }: { state: SyncState }) {
  const color = colors[BEAM[state]];
  // One animation drives both halves of the beam.
  const sweep = useSweep();
  return (
    <View style={styles.level} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.half}>
        <LaserLine color={color} scale={sweep} from="end" />
      </View>
      <View style={[styles.ring, styles.outerRing]}>
        <View style={[styles.ring, styles.innerRing]}>
          <View style={[styles.ring, styles.core, { backgroundColor: color, boxShadow: `0 0 18px 2px ${color}` }]}>
            <MaterialCommunityIcons name={CORE_ICON[state]} size={20} color={colors.brand} />
          </View>
        </View>
      </View>
      <View style={styles.half}>
        <LaserLine color={color} scale={sweep} from="start" />
      </View>
    </View>
  );
}

export function SiteStatus({
  business,
  role,
  email,
  sync,
  readouts,
}: {
  business: string;
  role: string;
  email?: string | null;
  /** Absent in local mode: nothing syncs, so there is no beam. */
  sync?: { state: SyncState; headline: ReactNode };
  /** Instrument readouts along the bottom: a value over its label. */
  readouts: Readout[];
}) {
  return (
    <View style={styles.stage}>
      <View style={styles.who}>
        {/* Stretched: shrink-wrapped Nastaliq gets its last word dropped on Android. */}
        <T variant="title" style={styles.business}>
          {business}
        </T>
        <View style={styles.identity}>
          <T variant="small" style={styles.onBrand}>
            {role}
          </T>
          {email ? <Num style={[styles.onBrand, styles.email]}>{email}</Num> : null}
        </View>
      </View>

      {sync ? (
        <View>
          <Level state={sync.state} />
          <View style={styles.headline}>{sync.headline}</View>
        </View>
      ) : null}

      <Readouts readouts={readouts} />
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
  level: { flexDirection: 'row', alignItems: 'center' },
  half: { flex: 1 },
  ring: { borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  outerRing: { width: 88, height: 88, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  innerRing: { width: 58, height: 58, borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
  core: { width: 32, height: 32 },
  stage: { backgroundColor: colors.brand, paddingBottom: space.lg, gap: space.md },
  who: { alignItems: 'center', paddingHorizontal: space.lg },
  business: { color: colors.white, textAlign: 'center', alignSelf: 'stretch' },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap', justifyContent: 'center' },
  onBrand: { color: colors.brandSoft },
  email: { fontSize: 14, lineHeight: 28 },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  readouts: { flexDirection: 'row', justifyContent: 'center', paddingHorizontal: space.lg },
  rule: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.18)' },
  readout: { flex: 1, alignItems: 'center', paddingHorizontal: space.sm },
  readoutValue: { color: colors.white, fontSize: 18, lineHeight: 28 },
  readoutLabel: { textAlign: 'center', alignSelf: 'stretch' },
  listStage: { backgroundColor: colors.brand, paddingTop: space.xs, paddingBottom: space.lg },
});
