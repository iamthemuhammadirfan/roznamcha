import { useStatus } from '@powersync/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { Alert, StyleSheet, View } from 'react-native';

import { usePendingUploadCount } from '@/db/hooks';
import { useMember, useSession } from '@/state/session';
import { lang, type Lang, setLanguage, t } from '@/i18n';
import { Banner, Row, Screen } from '@/ui/controls';
import { SettingsRow, SettingsSection } from '@/ui/settings-list';
import { Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

// Each language is named in itself, so someone who can't read the current UI can still
// find theirs.
const LANGUAGES: { value: Lang; label: string }[] = [
  { value: 'ur', label: 'اردو' },
  { value: 'en', label: 'English' },
];

export default function Settings() {
  const { localMode, signOut } = useSession();
  const member = useMember();
  const status = useStatus();
  const pending = usePendingUploadCount();
  const { isUpdatePending } = Updates.useUpdates();
  const isOwner = member.role === 'owner';

  function confirmSignOut() {
    Alert.alert(t.auth.signOut, t.auth.signOutConfirm, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.auth.signOut, style: 'destructive', onPress: signOut },
    ]);
  }

  function chooseLanguage() {
    Alert.alert(t.settings.language, t.settings.languageHelp, [
      ...LANGUAGES.filter((l) => l.value !== lang).map((l) => ({ text: l.label, onPress: () => setLanguage(l.value) })),
      { text: t.action.cancel, style: 'cancel' as const },
    ]);
  }

  const syncDetail = !status.hasSynced ? t.sync.firstSync : status.connected ? t.sync.synced : t.sync.offline;

  return (
    <Screen>
      {localMode ? <Banner text={t.app.localMode} /> : null}

      <View style={styles.identity}>
        <T variant="h1" style={{ color: colors.white }}>
          {member.businessName}
        </T>
        <Row style={{ flexWrap: 'wrap' }}>
          <View style={styles.role}>
            <T variant="small" style={{ color: colors.brand }}>
              {t.role[member.role]}
            </T>
          </View>
          {member.email ? <Num style={{ color: colors.brandSoft, fontSize: 15 }}>{member.email}</Num> : null}
        </Row>
      </View>

      {isOwner ? (
        <SettingsSection title={t.settings.lists}>
          <SettingsRow icon="hammer-wrench" label={t.trades.title} onPress={() => router.push('/trades')} />
          <SettingsRow
            icon="receipt-text-outline"
            label={t.expense.categories}
            onPress={() => router.push('/expense-categories')}
          />
        </SettingsSection>
      ) : null}

      <SettingsSection title={t.settings.app}>
        <SettingsRow
          icon="translate"
          label={t.settings.language}
          value={LANGUAGES.find((l) => l.value === lang)?.label}
          onPress={chooseLanguage}
        />
        {!localMode ? (
          <SettingsRow
            icon={status.connected ? 'cloud-check-outline' : 'cloud-off-outline'}
            label={t.settings.sync}
            detail={syncDetail}
            value={
              pending > 0 ? (
                <Row style={{ gap: space.xs }}>
                  <Num bold style={{ color: colors.pending }}>
                    {pending}
                  </Num>
                  <T variant="small" style={{ color: colors.pending }}>
                    {t.sync.pending}
                  </T>
                </Row>
              ) : undefined
            }
          />
        ) : null}
        <SettingsRow
          icon="information-outline"
          label={t.settings.version}
          value={<Num style={{ color: colors.muted }}>{Constants.expoConfig?.version}</Num>}
          detail={Updates.updateId ? <Num style={styles.debug}>{Updates.updateId.slice(0, 8)}</Num> : undefined}
        />
        {isUpdatePending ? (
          <SettingsRow
            icon="restart"
            label={t.settings.restart}
            detail={t.settings.updateReady}
            onPress={() => Updates.reloadAsync()}
          />
        ) : null}
      </SettingsSection>

      {/* Shown in Urdu-agnostic form on purpose: this is for whoever is debugging. */}
      {!localMode && status.downloadError ? (
        <Num style={styles.error}>{`download: ${status.downloadError.message}`}</Num>
      ) : null}
      {!localMode && status.uploadError ? (
        <Num style={styles.error}>{`upload: ${status.uploadError.message}`}</Num>
      ) : null}

      {!localMode ? (
        <SettingsSection>
          <SettingsRow icon="logout" label={t.auth.signOut} tone="danger" onPress={confirmSignOut} />
        </SettingsSection>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: {
    backgroundColor: colors.brand,
    borderRadius: 16,
    padding: space.lg,
    gap: space.sm,
  },
  role: {
    backgroundColor: colors.brandSoft,
    borderRadius: 999,
    paddingHorizontal: space.md,
  },
  debug: { fontSize: 12, color: colors.muted },
  error: { fontSize: 12, color: colors.recover, paddingHorizontal: space.sm },
});
