import * as SplashScreen from 'expo-splash-screen';
import LottieView from 'lottie-react-native';
import { createContext, type ReactNode, use, useCallback, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { colors } from './theme';

// The animation is 2 s. If the native view never reports finishing (a codec or asset
// problem on some cheap phone), the app must still open.
const MAX_SPLASH_MS = 4000;
const FADE_MS = 300;

const ContentReady = createContext<() => void>(() => {});

/** Called by the first real screen once it has mounted, so the splash lifts onto it. */
export function useContentReady() {
  return use(ContentReady);
}

/**
 * Lottie splash drawn over the navigator. It takes over from the native splash, plays
 * once, and fades only when the animation is done AND the screen the user should see is
 * mounted underneath — so neither a half-played animation nor the router's parked
 * sign-in screen is ever visible. Being JS, it also covers a dev reload, where the
 * native splash doesn't come back.
 */
export function AnimatedSplash({
  canStart,
  ready,
  children,
}: {
  /** False while the app may still restart itself (layout direction), behind the native splash. */
  canStart: boolean;
  /** The signed-out path: sign-in is the real screen and is ready to show. */
  ready: boolean;
  children: ReactNode;
}) {
  const [appMounted, setAppMounted] = useState(false);
  const [played, setPlayed] = useState(false);
  const [gone, setGone] = useState(false);
  const opacity = useSharedValue(1);
  const fade = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  const contentReady = useCallback(() => setAppMounted(true), []);

  // Once playback can start, the native splash hands over as soon as Lottie has drawn
  // its first frame (onAnimationLoaded); the timeout is the fallback for both steps.
  useEffect(() => {
    if (!canStart) return;
    const timer = setTimeout(() => {
      SplashScreen.hideAsync();
      setPlayed(true);
    }, MAX_SPLASH_MS);
    return () => clearTimeout(timer);
  }, [canStart]);

  const shown = ready || appMounted;
  useEffect(() => {
    if (!played || !shown) return;
    // Runs on the UI thread; only unmounting the overlay hops back to JS.
    opacity.set(
      withTiming(0, { duration: FADE_MS }, (finished) => {
        if (finished) scheduleOnRN(setGone, true);
      }),
    );
  }, [played, shown, opacity]);

  return (
    <ContentReady value={contentReady}>
      {children}
      {gone ? null : (
        <Animated.View style={[StyleSheet.absoluteFill, styles.cover, fade]}>
          {canStart ? (
            <LottieView
              // require, not import: Metro resolves it to an asset id, which LottieView's
              // `source` type doesn't declare.
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('@/assets/animations/splash.lottie')}
              autoPlay
              loop={false}
              resizeMode="contain"
              style={styles.animation}
              onAnimationLoaded={() => SplashScreen.hideAsync()}
              onAnimationFinish={() => setPlayed(true)}
              onAnimationFailure={() => {
                SplashScreen.hideAsync();
                setPlayed(true);
              }}
            />
          ) : null}
        </Animated.View>
      )}
    </ContentReady>
  );
}

const styles = StyleSheet.create({
  // Same colour as the native splash in app.json, so the handover is invisible.
  cover: { backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  // The artwork is 864×876.
  animation: { width: '80%', maxWidth: 360, aspectRatio: 864 / 876 },
});
