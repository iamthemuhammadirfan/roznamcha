import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { t } from '@/i18n';
import { useMember, useSession } from '@/state/session';
import { Banner } from '@/ui/controls';
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

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Continues the header, like the Settings stage. */}
        <View style={styles.stage}>
          <View style={styles.avatar}>
            <MaterialCommunityIcons name={icon} size={40} color={colors.brand} />
          </View>
          {member.email ? (
            <Num bold style={styles.email}>
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
  email: { color: colors.white, fontSize: 18, lineHeight: 28 },
  roleChip: { backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: space.md },
  sections: { paddingTop: space.lg, gap: space.lg },
  inset: { paddingHorizontal: space.lg },
  detail: { fontSize: 14, lineHeight: 24, color: colors.muted },
});
