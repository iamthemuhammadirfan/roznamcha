// Dev builds only: says which database this phone is talking to, and shouts when it is a
// real customer's data. Release builds (the APK, OTA updates) compile it to nothing —
// `__DEV__` is false there, so customers never see it.
import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { backendConfigured } from '@/lib/supabase';
import { useSession } from '@/state/session';

import { T } from './text';
import { colors, space } from './theme';

/** The live Supabase project; anything else (the laptop's `supabase start`) is local. */
const LIVE_PROJECT = 'pagnqnthpxdlpfnvtoip';
/** The business on the live project that is safe to play with. */
const SANDBOX_BUSINESS = 'Roznamcha Test';

const onLive = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').includes(LIVE_PROJECT);

export function DevRibbon() {
  const { state } = useSession();
  if (!__DEV__ || !backendConfigured) return null;

  if (!onLive) {
    return (
      <View style={[styles.ribbon, { backgroundColor: colors.brandSoft }]}>
        <T variant="small" style={[styles.text, { color: colors.brand }]}>
          {t.dev.local}
        </T>
      </View>
    );
  }
  // Live project, sandbox business: the normal way to try things, so stay quiet.
  if (state.status !== 'ready' || state.member.businessName === SANDBOX_BUSINESS) return null;
  return (
    <View style={[styles.ribbon, { backgroundColor: colors.recover }]}>
      <T variant="small" style={[styles.text, { color: colors.white }]}>
        {`${t.dev.live} · ${state.member.businessName}`}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  ribbon: { paddingHorizontal: space.md, paddingVertical: 2 },
  // Stretched: shrink-wrapped Nastaliq gets its last word dropped on Android.
  text: { textAlign: 'center', alignSelf: 'stretch' },
});
