import {
  NotoNaskhArabic_400Regular,
  NotoNaskhArabic_700Bold,
} from '@expo-google-fonts/noto-naskh-arabic';
import { PowerSyncContext } from '@powersync/react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';

import { powersync } from '@/db';
import { ensureDirection } from '@/i18n';
import { ActiveProjectProvider } from '@/state/active-project';
import { SessionProvider, useSession } from '@/state/session';
import { AnimatedSplash } from '@/ui/animated-splash';

SplashScreen.preventAutoHideAsync();

// Expo Router resolves the launch URL asynchronously and then updates navigation
// state, so the navigator must be mounted on the very first render — never return
// null or a placeholder here. The native splash, then the Lottie splash, cover the
// screen until fonts and the session are ready.
function Gate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { state } = useSession();
  // Urdu ⇄ English also flips the layout direction, which only applies on restart. On
  // first launch (or if the phone's language disagrees with the saved choice) this
  // flips it and restarts once, behind the splash.
  const [directionOk, setDirectionOk] = useState(false);
  useEffect(() => {
    ensureDirection().then((restarting) => {
      if (!restarting) setDirectionOk(true);
    });
  }, []);
  const booted = fontsLoaded && directionOk;
  // (app) only becomes reachable once everything it renders is ready; until then the
  // router parks on sign-in behind the splash.
  const ready = booted && state.status === 'ready';
  const signedOut = state.status === 'signedOut' || state.status === 'noMembership';

  // The Lottie splash lifts once the screen that ends up shown has mounted: sign-in
  // right here when signed out, otherwise (app)/_layout reports in. Hiding it when the
  // guard flips instead would flash sign-in, because the redirect lands a frame later.
  return (
    <AnimatedSplash canStart={directionOk} ready={booted && signedOut}>
      <Stack screenOptions={{ headerShown: false, animation: 'none' }}>
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!ready}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
    </AnimatedSplash>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoNaskhArabic_400Regular,
    NotoNaskhArabic_700Bold,
    JameelNooriNastaleeq: require('@/assets/fonts/JameelNooriNastaleeq.ttf'),
  });

  return (
    <PowerSyncContext value={powersync}>
      <SessionProvider>
        <ActiveProjectProvider>
          <StatusBar style="light" />
          <Gate fontsLoaded={fontsLoaded} />
        </ActiveProjectProvider>
      </SessionProvider>
    </PowerSyncContext>
  );
}
