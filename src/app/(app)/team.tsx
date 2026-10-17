import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, View } from 'react-native';

import { useMembers } from '@/db/hooks';
import { lang, t } from '@/i18n';
import { formatDay } from '@/lib/dates';
import { revokeMunshi } from '@/lib/team';
import { useMember, useSession } from '@/state/session';
import { ChoiceDialog } from '@/ui/choice-dialog';
import { Button, Card, Empty, Row, Tool } from '@/ui/controls';
import { ListBanner, ListScreen } from '@/ui/list-screen';
import { Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

type Member = ReturnType<typeof useMembers>[number];

/**
 * Owner's team: the munshi accounts of this business (the owner is on My account, not
 * here). Each card resets that munshi's password or removes their access; the button at
 * the bottom adds one. All go through the `team` Edge Function, so they need internet.
 * Removing access keeps everything the munshi entered.
 */
export default function TeamScreen() {
  const members = useMembers();
  const { role, businessId } = useMember();
  const { localMode } = useSession();
  const [removing, setRemoving] = useState<Member | null>(null);
  // The card whose removal is in flight, so its buttons can't be pressed twice.
  const [working, setWorking] = useState<string | null>(null);

  if (role !== 'owner' || localMode) {
    return (
      <ListScreen>
        <ListBanner text={t.team.errors.not_owner} />
      </ListScreen>
    );
  }

  const munshis = members.filter((m) => m.role === 'munshi');

  async function revoke(m: Member) {
    setWorking(m.user_id);
    const error = await revokeMunshi(businessId, m.user_id);
    setWorking(null);
    // On success the membership is gone and the card drops out of the list by itself.
    Alert.alert(error ? t.team.errors[error] : t.team.revoked);
  }

  return (
    <ListScreen
      footer={<Button icon="account-plus-outline" label={t.team.add} onPress={() => router.push('/team-member')} />}>
      <FlatList
        data={munshis}
        keyExtractor={(m) => m.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          munshis.length > 0 ? (
            <Row style={{ gap: space.xs }}>
              <Num bold>{munshis.length}</Num>
              <T variant="small" style={{ flex: 1 }}>
                {t.role.munshi}
              </T>
            </Row>
          ) : null
        }
        ListEmptyComponent={<Empty text={t.team.empty} />}
        renderItem={({ item: m }) => (
          <MunshiCard
            m={m}
            busy={working === m.user_id}
            onReset={() =>
              router.push({ pathname: '/team-member', params: { userId: m.user_id, email: m.email ?? '' } })
            }
            onRevoke={() => setRemoving(m)}
          />
        )}
      />

      <ChoiceDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={t.team.revoke}
        description={removing ? `${removing.email ?? ''}\n${t.team.revokeConfirm}` : undefined}
        actions={[{ label: t.team.revoke, tone: 'danger', onPress: () => removing && revoke(removing) }]}
        cancelLabel={t.action.cancel}
      />
    </ListScreen>
  );
}

function MunshiCard({
  m,
  busy,
  onReset,
  onRevoke,
}: {
  m: Member;
  busy: boolean;
  onReset: () => void;
  onRevoke: () => void;
}) {
  // created_at is a server timestamp; its first ten characters are the day.
  const since = m.created_at ? formatDay(m.created_at.slice(0, 10), lang) : null;
  return (
    <Card style={{ gap: space.md }}>
      <Row style={{ alignItems: 'center' }}>
        <View style={styles.avatar}>
          <MaterialCommunityIcons name="account-hard-hat" size={28} color={colors.brand} />
        </View>
        <View style={{ flex: 1 }}>
          <Num bold numberOfLines={1} style={styles.email}>
            {m.email ?? '—'}
          </Num>
          <Row style={{ gap: space.xs }}>
            <T variant="small">{t.role.munshi}</T>
            {since ? (
              <T variant="small">
                {'·'} {t.team.since} {since}
              </T>
            ) : null}
          </Row>
        </View>
        {busy ? <ActivityIndicator color={colors.brand} /> : null}
      </Row>
      <Row>
        <Tool icon="lock-reset" label={t.team.resetTitle} onPress={onReset} disabled={busy} />
        <Tool icon="account-cancel-outline" label={t.team.revoke} danger onPress={onRevoke} disabled={busy} />
      </Row>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.lg, gap: space.md, flexGrow: 1 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  email: { fontSize: 17, lineHeight: 26 },
});
