import Constants from 'expo-constants';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useAppConfig } from '@/db/hooks';
import { isUrdu, t } from '@/i18n';
import { Button } from '@/ui/controls';
import { HeaderTitle, TabsHeaderTitle } from '@/ui/header';
import { SyncBadge } from '@/ui/sync-badge';
import { T } from '@/ui/text';
import { colors, fonts, space } from '@/ui/theme';

function versionBelow(current: string, min: string) {
  const a = current.split('.').map(Number);
  const b = min.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) < (b[i] ?? 0);
  }
  return false;
}

/** Full-screen stop when app_config says this APK is too old for the server. */
function useUpdateRequired() {
  const cfg = useAppConfig();
  const current = Constants.expoConfig?.version ?? '0.0.0';
  if (!cfg?.min_supported_version || !versionBelow(current, cfg.min_supported_version)) return null;
  return cfg;
}

function title(t: string, scoped = true) {
  return function Title() {
    return <HeaderTitle title={t} scoped={scoped} />;
  };
}

export default function AppLayout() {
  const required = useUpdateRequired();
  // The root gate only lets this layout mount once boot is done; hiding the splash
  // here (rather than there) means the first frame the user sees is the app, not sign-in.
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);
  if (required) {
    return (
      <View style={styles.blocked}>
        <T variant="h1">{t.update.required}</T>
        <T>{t.update.requiredBody}</T>
        {required.latest_apk_url ? (
          <Button label={t.update.download} onPress={() => Linking.openURL(required.latest_apk_url!)} />
        ) : null}
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: colors.white,
        headerTitleStyle: { fontFamily: isUrdu ? fonts.urdu : fonts.latin },
        headerRight: () => <SyncBadge />,
        contentStyle: { backgroundColor: colors.bg },
      }}>
      <Stack.Screen name="(tabs)" options={{ headerTitle: () => <TabsHeaderTitle /> }} />
      <Stack.Screen name="project/[id]" options={{ headerTitle: title(t.project.title) }} />
      <Stack.Screen name="project-workers" options={{ headerTitle: title(t.dashboard.workersOnProject) }} />
      <Stack.Screen name="project-form" options={{ headerTitle: title(t.project.title, false) }} />
      <Stack.Screen name="add-worker" options={{ headerTitle: title(t.action.addWorker) }} />
      <Stack.Screen name="worker-form" options={{ headerTitle: title(t.worker.edit, false) }} />
      <Stack.Screen name="assign" options={{ headerTitle: title(t.assignment.title) }} />
      <Stack.Screen name="worker/[id]" options={{ headerTitle: title(t.ledger.title, false) }} />
      <Stack.Screen name="attendance" options={{ headerTitle: title(t.attendance.title) }} />
      <Stack.Screen name="attendance-day" options={{ headerTitle: title(t.attendance.title) }} />
      <Stack.Screen name="entry" options={{ headerTitle: title(t.entry.new) }} />
      <Stack.Screen name="receipt/[id]" options={{ headerTitle: title(t.receipt.title, false) }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  blocked: { flex: 1, justifyContent: 'center', padding: space.xl, gap: space.lg, backgroundColor: colors.bg },
});
