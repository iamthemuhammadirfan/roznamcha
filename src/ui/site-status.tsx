// The top of Settings: a full-width stage that continues the header, with who this
// phone belongs to and whether its data is safe. At its centre, a laser level: an
// emitter whose beam runs to both edges, coloured by the sync state.
// Built with Tamagui (Settings only).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from '@tamagui/core';
import { useFocusEffect } from 'expo-router';
import { Fragment, type ReactNode, useCallback, useEffect } from 'react';
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
import { XStack, YStack } from './tamagui.config';
import { Digits, Text } from './tamagui-text';
import { colors } from './theme';

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
    <XStack alignItems="center" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <YStack flex={1}>
        <LaserLine color={color} scale={sweep} from="end" />
      </YStack>
      <View
        width={88}
        height={88}
        borderRadius="round"
        borderWidth={1}
        borderColor="rgba(255,255,255,0.12)"
        alignItems="center"
        justifyContent="center">
        <View
          width={58}
          height={58}
          borderRadius="round"
          borderWidth={1}
          borderColor="rgba(255,255,255,0.28)"
          alignItems="center"
          justifyContent="center">
          <View
            width={32}
            height={32}
            borderRadius="round"
            backgroundColor={BEAM[state]}
            boxShadow={`0 0 18px 2px ${color}`}
            alignItems="center"
            justifyContent="center">
            <MaterialCommunityIcons name={CORE_ICON[state]} size={20} color={colors.brand} />
          </View>
        </View>
      </View>
      <YStack flex={1}>
        <LaserLine color={color} scale={sweep} from="start" />
      </YStack>
    </XStack>
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
    <YStack backgroundColor="brand" paddingBottom="lg" gap="md">
      <YStack alignItems="center" paddingHorizontal="lg">
        <Text variant="title" color="white" textAlign="center">
          {business}
        </Text>
        <XStack alignItems="center" gap="sm" flexWrap="wrap" justifyContent="center">
          <Text variant="small" color="brandSoft">
            {role}
          </Text>
          {email ? (
            <Digits variant="small" color="brandSoft" fontSize={14}>
              {email}
            </Digits>
          ) : null}
        </XStack>
      </YStack>

      {sync ? (
        <YStack>
          <Level state={sync.state} />
          <XStack alignItems="center" justifyContent="center" gap="sm" paddingHorizontal="lg">
            {sync.headline}
          </XStack>
        </YStack>
      ) : null}

      <Readouts readouts={readouts} />
    </YStack>
  );
}

export interface Readout {
  label: string;
  value: string;
}

/** Instrument readouts: each a value over its label, divided by thin rules. */
function Readouts({ readouts }: { readouts: Readout[] }) {
  return (
    <XStack justifyContent="center" paddingHorizontal="lg">
      {readouts.map((r, i) => (
        <Fragment key={r.label}>
          {i > 0 ? <View width={1} alignSelf="stretch" backgroundColor="rgba(255,255,255,0.18)" /> : null}
          <YStack flex={1} alignItems="center" paddingHorizontal="sm">
            <Digits variant="h2" bold color="white">
              {r.value}
            </Digits>
            <Text variant="small" color="brandSoft" textAlign="center">
              {r.label}
            </Text>
          </YStack>
        </Fragment>
      ))}
    </XStack>
  );
}

/** The stage for the pages Settings opens: just the readouts, continuing the header. */
export function ListStage({ readouts }: { readouts: Readout[] }) {
  return (
    <YStack backgroundColor="brand" paddingTop="xs" paddingBottom="lg">
      <Readouts readouts={readouts} />
    </YStack>
  );
}
