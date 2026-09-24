import {
  NotoNaskhArabic_400Regular,
  NotoNaskhArabic_700Bold,
} from '@expo-google-fonts/noto-naskh-arabic';
import {
  NotoNastaliqUrdu_400Regular,
  NotoNastaliqUrdu_700Bold,
} from '@expo-google-fonts/noto-nastaliq-urdu';
import { PowerSyncContext } from '@powersync/react-native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { powersync } from '@/db';
import { ActiveProjectProvider } from '@/state/active-project';
import { SessionProvider, useSession } from '@/state/session';

SplashScreen.preventAutoHideAsync();

// Expo Router resolves the launch URL asynchronously and then updates navigation
// state, so the navigator must be mounted on the very first render — never return
// null or a placeholder here. The native splash covers the screen until fonts and the
// session are ready.
function Gate({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { state } = useSession();
  const booting = !fontsLoaded || state.status === 'loading';

  useEffect(() => {
    if (!booting) SplashScreen.hideAsync();
  }, [booting]);

  const ready = state.status === 'ready';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={ready}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!ready}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    NotoNaskhArabic_400Regular,
    NotoNaskhArabic_700Bold,
    NotoNastaliqUrdu_400Regular,
    NotoNastaliqUrdu_700Bold,
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
