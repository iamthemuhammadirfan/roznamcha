import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { createMunshi, MIN_PASSWORD, resetMunshiPassword, type TeamError } from '@/lib/team';
import { useMember } from '@/state/session';
import { Banner, Button, Card, Field, Screen } from '@/ui/controls';
import { HeaderTitle } from '@/ui/header';
import { Num, T } from '@/ui/text';
import { colors, fonts } from '@/ui/theme';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Owner only, opened from Settings → Team. With `userId`: set that munshi's password.
 * Without: create a new munshi (email + password). The password is shown in plain text
 * on purpose — the owner has to tell it to the munshi.
 */
export default function TeamMember() {
  const params = useLocalSearchParams<{ userId?: string; email?: string }>();
  const resetting = Boolean(params.userId);
  const { businessId, role } = useMember();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<TeamError | null>(null);
  const [busy, setBusy] = useState(false);

  if (role !== 'owner') return <Screen>{<Banner text={t.team.errors.not_owner} />}</Screen>;

  // Checked here first so the common mistakes don't need the internet to be caught.
  const local: TeamError | null =
    !resetting && email.trim() && !EMAIL.test(email.trim())
      ? 'invalid_email'
      : password && password.length < MIN_PASSWORD
        ? 'weak_password'
        : null;
  const ready = (resetting || EMAIL.test(email.trim())) && password.length >= MIN_PASSWORD;

  async function submit() {
    if (!ready) return;
    setBusy(true);
    setError(null);
    const result = resetting
      ? await resetMunshiPassword(businessId, params.userId!, password)
      : await createMunshi(businessId, email, password);
    setBusy(false);
    if (result) return setError(result);
    router.back();
    Alert.alert(resetting ? t.team.resetDone : t.team.created);
  }

  const shown = error ?? local;
  return (
    <Screen footer={<Button label={resetting ? t.team.save : t.team.create} onPress={submit} busy={busy} disabled={!ready} />}>
      {resetting ? <Stack.Screen options={{ headerTitle: () => <HeaderTitle title={t.team.resetTitle} scoped={false} /> }} /> : null}

      {resetting ? (
        <Card>
          <T variant="bodyBold">{t.role.munshi}</T>
          {params.email ? <Num style={{ color: colors.muted }}>{params.email}</Num> : null}
        </Card>
      ) : (
        <Field
          label={t.auth.email}
          hint={t.team.emailHint}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          autoFocus
          testID="team-email"
          style={styles.latin}
        />
      )}

      <Field
        label={resetting ? t.team.newPassword : t.auth.password}
        hint={t.team.passwordHint}
        value={password}
        onChangeText={setPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        autoFocus={resetting}
        onSubmitEditing={submit}
        testID="team-password"
        style={styles.latin}
      />

      {shown ? <Banner tone="recover" text={t.team.errors[shown]} /> : <T variant="small">{t.team.online}</T>}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Emails and passwords are Latin: typed left-to-right, in the system font.
  latin: { writingDirection: 'ltr', fontFamily: fonts.latin },
});
