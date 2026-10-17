import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMembers } from '@/db/hooks';
import { t } from '@/i18n';
import { useMember, useSession } from '@/state/session';
import { Banner, Button } from '@/ui/controls';
import { SettingsRow, SettingsSection } from '@/ui/settings-list';
import { Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

/**
 * My account: who is signed in on this phone, for which business, and as what. Personal
 * settings (e.g. changing one's own password) belong here as they are added.
 */
export default function AccountScreen() {
  const member = useMember();
  const { localMode } = useSession();
  const icon = member.role === 'owner' ? 'account-tie' : 'account-hard-hat';
  // This person's own row, for their name and number (synced; null in local mode).
  const me = useMembers().find((m) => m.user_id === member.userId && m.business_id === member.businessId);

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Continues the header, like the Settings stage. */}
        <View style={styles.stage}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name={icon} size={40} color={colors.brand} />
          </View>
          {me?.name ? (
            <T variant="h1" style={styles.name}>
              {me.name}
            </T>
          ) : null}
          {member.email ? (
            <Num bold={!me?.name} style={styles.email}>
              {member.email}
            </Num>
          ) : null}
          <View style={styles.roleChip}>
            <T variant="bodyBold" style={{ color: colors.brand }}>
              {t.role[member.role]}
            </T>
          </View>
        </View>

        <View style={styles.sections}>
          {localMode ? (
            <View style={styles.inset}>
              <Banner text={t.app.localMode} />
            </View>
          ) : null}
          <SettingsSection>
            <SettingsRow
              icon="account-outline"
              label={t.team.name}
              detail={me?.name ?? t.team.noName}
            />
            <SettingsRow
              icon="phone-outline"
              label={t.team.phoneOptional}
              detail={me?.phone ? <Num style={styles.detail}>{me.phone}</Num> : '—'}
            />
            <SettingsRow icon="office-building-outline" label={t.settings.business} detail={member.businessName} />
            <SettingsRow icon={icon} label={t.settings.role} detail={t.role[member.role]} />
            {member.email ? (
              <SettingsRow
                icon="email-outline"
                label={t.auth.email}
                detail={<Num style={styles.detail}>{member.email}</Num>}
              />
            ) : null}
          </SettingsSection>
          {me ? (
            <View style={styles.inset}>
              <Button
                kind="secondary"
                icon="pencil-outline"
                label={t.team.details}
                onPress={() => router.push({ pathname: '/member-details', params: { id: me.id } })}
              />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: space.xl },
  stage: {
    backgroundColor: colors.brand,
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.brandSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: colors.white, textAlign: 'center', alignSelf: 'stretch' },
  email: { color: colors.brandSoft, fontSize: 16, lineHeight: 26 },
  roleChip: { backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: space.md },
  sections: { paddingTop: space.lg, gap: space.lg },
  inset: { paddingHorizontal: space.lg },
  detail: { fontSize: 14, lineHeight: 24, color: colors.muted },
});
