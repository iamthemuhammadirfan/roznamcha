import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { useMemberProjects, useMembers, useProjects } from '@/db/hooks';
import { setMemberProjects, updateMemberDetails } from '@/db/mutations';
import { t } from '@/i18n';
import { accessOf, type ProjectAccess } from '@/lib/access';
import { cleanName, cleanPhone, type TeamError } from '@/lib/team';
import { useMember, useWriteContext } from '@/state/session';
import { Banner, Button, Empty, Field, Screen } from '@/ui/controls';
import { ProjectAccessPicker } from '@/ui/project-access';
import { Num } from '@/ui/text';
import { colors, fonts } from '@/ui/theme';

/**
 * A member's name and phone, from Team (the owner, for a munshi) or My account (anyone,
 * for themselves). The owner also picks a munshi's projects here. Saved locally like
 * every other edit, so it works offline; RLS lets only these columns through, for
 * exactly those cases (projects: the owner only).
 */
export default function MemberDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const row = useMembers().find((m) => m.id === id);
  const { role, userId } = useMember();
  const ctx = useWriteContext();
  const projects = useProjects();
  const picks = useMemberProjects();
  const [name, setName] = useState<string | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [access, setAccess] = useState<ProjectAccess | null>(null);
  const [error, setError] = useState<TeamError | null>(null);

  if (!row) return <Empty text={t.team.errors.not_munshi} />;
  const ownerOfMunshi = role === 'owner' && row.role === 'munshi';
  const allowed = row.user_id === userId || ownerOfMunshi;
  if (!allowed) return <Empty text={t.team.errors.not_owner} />;

  // Drafts start from the saved values once the row has loaded.
  const nameDraft = name ?? row.name ?? '';
  const phoneDraft = phone ?? row.phone ?? '';
  const accessDraft = access ?? accessOf(row, picks);

  async function save() {
    const n = cleanName(nameDraft);
    if (!n) return setError('invalid_name');
    const p = cleanPhone(phoneDraft);
    if (p === false) return setError('invalid_phone');
    // Only when changed: Save is also how the owner assigns projects.
    if (n !== row!.name || p !== row!.phone) await updateMemberDetails(row!.id, n, p);
    if (ownerOfMunshi && access) await setMemberProjects(ctx, row!, access);
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
      {ownerOfMunshi ? <ProjectAccessPicker projects={projects} value={accessDraft} onChange={setAccess} /> : null}
      {error ? <Banner tone="recover" text={t.team.errors[error]} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  email: { color: colors.muted, fontSize: 15 },
  latin: { fontFamily: fonts.latin },
});
