import { router } from 'expo-router';
import { FlatList, StyleSheet } from 'react-native';

import { useMembers } from '@/db/hooks';
import { t } from '@/i18n';
import { useMember, useSession } from '@/state/session';
import { Button } from '@/ui/controls';
import { IconAction, ListRow } from '@/ui/list-group';
import { ListBanner, ListScreen } from '@/ui/list-screen';
import { ListStage } from '@/ui/site-status';
import { Num } from '@/ui/text';
import { colors } from '@/ui/theme';

/**
 * Owner's team: who can sign in to this business and as what. A munshi's row resets
 * their password; the button at the bottom adds a munshi. Both open team-member and go
 * through the `team` Edge Function, so they need internet. Owners aren't managed here.
 */
export default function TeamScreen() {
  const members = useMembers();
  const { role, userId } = useMember();
  const { localMode } = useSession();

  if (role !== 'owner' || localMode) {
    return (
      <ListScreen>
        <ListBanner text={t.team.errors.not_owner} />
      </ListScreen>
    );
  }

  const munshis = members.filter((m) => m.role === 'munshi').length;

  return (
    <ListScreen
      footer={<Button icon="account-plus-outline" label={t.team.add} onPress={() => router.push('/team-member')} />}>
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        ListHeaderComponent={
          <ListStage
            readouts={[
              { label: t.role.owner, value: String(members.length - munshis) },
              { label: t.role.munshi, value: String(munshis) },
            ]}
          />
        }
        renderItem={({ item: m, index }) => {
          const munshi = m.role === 'munshi';
          const you = m.user_id === userId;
          return (
            <ListRow
              label={you ? `${t.role[munshi ? 'munshi' : 'owner']} · ${t.settings.you}` : t.role[munshi ? 'munshi' : 'owner']}
              detail={m.email ? <Num style={styles.email}>{m.email}</Num> : null}
              divider={index > 0}>
              {munshi ? (
                <IconAction
                  icon="lock-reset"
                  label={t.team.resetTitle}
                  onPress={() =>
                    router.push({ pathname: '/team-member', params: { userId: m.user_id, email: m.email ?? '' } })
                  }
                />
              ) : null}
            </ListRow>
          );
        }}
      />
    </ListScreen>
  );
}

const styles = StyleSheet.create({
  email: { fontSize: 14, lineHeight: 22, color: colors.muted },
});
