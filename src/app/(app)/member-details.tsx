import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useMembers } from '@/db/hooks';
import { updateMemberDetails } from '@/db/mutations';
import { t } from '@/i18n';
import { cleanName, cleanPhone, type TeamError } from '@/lib/team';
import { useMember } from '@/state/session';
import { Banner, Button, Empty, Field, Screen } from '@/ui/controls';
import { Num } from '@/ui/text';
import { colors, fonts } from '@/ui/theme';

/**
 * A member's name and phone, from Team (the owner, for a munshi) or My account (anyone,
 * for themselves). Saved locally like every other edit, so it works offline; RLS lets
 * only these two columns through, for exactly those two cases.
 */
export default function MemberDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const row = useMembers().find((m) => m.id === id);
  const { role, userId } = useMember();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<TeamError | null>(null);

  if (!row) return <Empty text={t.team.errors.not_munshi} />;
  const allowed = row.user_id === userId || (role === 'owner' && row.role === 'munshi');
  if (!allowed) return <Empty text={t.team.errors.not_owner} />;

  // Drafts start from the saved values once the row has loaded.
  const nameDraft = name ?? row.name ?? '';
  const phoneDraft = phone ?? row.phone ?? '';

  async function save() {
    const n = cleanName(nameDraft);
    if (!n) return setError('invalid_name');
    const p = cleanPhone(phoneDraft);
    if (p === false) return setError('invalid_phone');
    await updateMemberDetails(row!.id, n, p);
    router.back();
  }

  return (
    <Screen footer={<Button label={t.team.saveDetails} onPress={save} disabled={!nameDraft.trim()} />}>
      {row.email ? <Num style={styles.email}>{row.email}</Num> : null}
      <Field
        label={t.team.name}
        hint={t.team.detailsHint}
        value={nameDraft}
        onChangeText={(v) => {
          setName(v);
          setError(null);
        }}
        autoFocus
        maxLength={80}
        testID="member-name"
      />
      <Field
        label={t.team.phoneOptional}
        value={phoneDraft}
        onChangeText={(v) => {
          setPhone(v);
          setError(null);
        }}
        numeric
        keyboardType="phone-pad"
        maxLength={20}
        testID="member-phone"
        style={styles.latin}
      />
      {error ? <Banner tone="recover" text={t.team.errors[error]} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { color: colors.muted, fontSize: 15 },
  latin: { fontFamily: fonts.latin },
});
