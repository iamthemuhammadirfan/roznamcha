import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useSession } from '@/state/session';
import { ur } from '@/strings.ur';
import { Banner, Button, Field, Screen } from '@/ui/controls';
import { T } from '@/ui/text';
import { space } from '@/ui/theme';

export default function SignIn() {
  const { state, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function submit() {
    setBusy(true);
    setFailed(false);
    const ok = await signIn(email, password);
    setBusy(false);
    if (!ok) setFailed(true);
  }

  return (
    <Screen>
      <View style={styles.hero}>
        <T variant="title" style={styles.title}>
          {ur.app.name}
        </T>
        <T variant="small">{ur.app.tagline}</T>
      </View>
      {state.status === 'noMembership' ? <Banner tone="recover" text={ur.auth.noMembership} /> : null}
      {failed ? <Banner tone="recover" text={ur.auth.failed} /> : null}
      <Field
        label={ur.auth.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        style={styles.ltr}
      />
      <Field
        label={ur.auth.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        style={styles.ltr}
      />
      <Button label={ur.auth.signIn} onPress={submit} busy={busy} disabled={!email || !password} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', paddingVertical: space.xl },
  title: { fontSize: 40, lineHeight: 96 },
  ltr: { writingDirection: 'ltr' },
});
