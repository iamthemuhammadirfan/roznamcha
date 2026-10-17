import { useStatus } from '@powersync/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePendingUploadCount } from '@/db/hooks';
import { formatDay, toDay } from '@/lib/dates';
import { RELEASE } from '@/release';
import { useMember, useSession } from '@/state/session';
import { lang, type Lang, setLanguage, t } from '@/i18n';
import { ChoiceDialog } from '@/ui/choice-dialog';
import { Banner } from '@/ui/controls';
import { SettingsRow, SettingsSection } from '@/ui/settings-list';
import { LaserLine, SiteStatus, type SyncState, useProgress } from '@/ui/site-status';
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
  const isOwner = member.role === 'owner';

  const [dialog, setDialog] = useState<'language' | 'signOut' | null>(null);

  // The stage's headline: what state the data on this phone is in, in one phrase.
  const syncState: SyncState = !status.hasSynced || pending > 0 ? 'pending' : status.connected ? 'saved' : 'offline';
  const headline =
    pending > 0 ? (
      <>
        <Num bold style={styles.pendingCount}>
          {pending}
        </Num>
        <T variant="title" style={styles.onBrand}>
          {t.sync.pending}
        </T>
      </>
    ) : (
      <T variant="title" style={[styles.onBrand, styles.centred]}>
        {!status.hasSynced ? t.sync.firstSync : status.connected ? t.sync.synced : t.sync.offline}
      </T>
    );

  // What exactly this phone runs: the release, the installed APK, and the date of the
  // update on top of it (none when running what the APK shipped with).
  const readouts = [
    { label: t.settings.version, value: RELEASE },
    { label: t.update.apk, value: Constants.expoConfig?.version ?? '' },
    ...(Updates.createdAt && !Updates.isEmbeddedLaunch
      ? [{ label: t.update.updatedOn, value: formatDay(toDay(Updates.createdAt), lang) }]
      : []),
  ];

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <SiteStatus
          business={member.businessName}
          role={t.role[member.role]}
          email={member.email}
          sync={localMode ? undefined : { state: syncState, headline }}
          readouts={readouts}
        />

        <View style={styles.sections}>
          {localMode ? (
            <View style={styles.inset}>
              <Banner text={t.app.localMode} />
            </View>
          ) : null}

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

          <SettingsSection title={t.settings.account}>
            <SettingsRow icon="account-circle-outline" label={t.settings.myAccount} onPress={() => router.push('/account')} />
            {/* Munshi accounts are managed on the server, so not in local mode. */}
            {isOwner && !localMode ? (
              <SettingsRow icon="account-group-outline" label={t.settings.team} onPress={() => router.push('/team')} />
            ) : null}
          </SettingsSection>

          <SettingsSection title={t.settings.app}>
            <SettingsRow
              icon="translate"
              label={t.settings.language}
              value={LANGUAGES.find((l) => l.value === lang)?.label}
              onPress={() => setDialog('language')}
            />
            <UpdateCheckRow />
          </SettingsSection>

          {/* Shown in Urdu-agnostic form on purpose: this is for whoever is debugging. */}
          {!localMode && status.downloadError ? (
            <Num style={[styles.debug, styles.inset]}>{`download: ${status.downloadError.message}`}</Num>
          ) : null}
          {!localMode && status.uploadError ? (
            <Num style={[styles.debug, styles.inset]}>{`upload: ${status.uploadError.message}`}</Num>
          ) : null}

          {!localMode ? (
            <SettingsSection>
              <SettingsRow icon="logout" label={t.auth.signOut} tone="danger" onPress={() => setDialog('signOut')} />
            </SettingsSection>
          ) : null}
        </View>
      </ScrollView>

      {/* Both languages, the current one marked: picking it again just closes. */}
      <ChoiceDialog
        open={dialog === 'language'}
        onClose={() => setDialog(null)}
        title={t.settings.language}
        description={t.settings.languageHelp}
        actions={LANGUAGES.map((l) => ({
          label: l.label,
          tone: l.value === lang ? 'current' : 'brand',
          onPress: () => l.value !== lang && setLanguage(l.value),
        }))}
        cancelLabel={t.action.cancel}
      />
      <ChoiceDialog
        open={dialog === 'signOut'}
        onClose={() => setDialog(null)}
        title={t.auth.signOut}
        description={t.auth.signOutConfirm}
        actions={[{ label: t.auth.signOut, tone: 'danger', onPress: signOut }]}
        cancelLabel={t.action.cancel}
      />
    </SafeAreaView>
  );
}

/**
 * Check for a new version now, instead of waiting for the next launch. Shows where the
 * check is — checking, downloading %, ready (restart), up to date — and when it last ran.
 */
function UpdateCheckRow() {
  const { isChecking, isDownloading, downloadProgress, isUpdatePending, lastCheckForUpdateTimeSinceRestart } =
    Updates.useUpdates();
  const progress = useProgress(downloadProgress ?? 0);
  // null = no failure; otherwise the error's message, shown small for whoever is debugging.
  const [failure, setFailure] = useState<string | null>(null);

  async function check() {
    setFailure(null);
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) await Updates.fetchUpdateAsync();
    } catch (e) {
      setFailure(e instanceof Error ? e.message : String(e));
    }
  }

  // Development builds load JS from the laptop; Expo refuses update checks there.
  if (!Updates.isEnabled || __DEV__) {
    return <SettingsRow icon="cloud-download-outline" label={t.update.check} detail={t.update.disabled} />;
  }
  if (isUpdatePending) {
    return (
      <SettingsRow
        icon="restart"
        label={t.settings.restart}
        detail={t.settings.updateReady}
        onPress={() => Updates.reloadAsync()}
      />
    );
  }
  if (isChecking || isDownloading) {
    const row = (
      <SettingsRow
        icon="cloud-download-outline"
        label={isDownloading ? t.update.downloading : t.update.checking}
        value={
          isDownloading ? (
            <Num bold style={{ color: colors.brand }}>{`${Math.round((downloadProgress ?? 0) * 100)}%`}</Num>
          ) : (
            <ActivityIndicator color={colors.brand} />
          )
        }
      />
    );
    if (!isDownloading) return row;
    // The stage's laser beam again, drawn as far as the download has got.
    return (
      <View>
        {row}
        <LaserLine color={colors.owed} scale={progress} />
      </View>
    );
  }
  const last = lastCheckForUpdateTimeSinceRestart;
  return (
    <SettingsRow
      icon="cloud-download-outline"
      label={t.update.check}
      detail={
        failure !== null ? (
          // Only blame the internet when the error is actually about the network.
          /network|internet|connect|timeout|host|offline/i.test(failure) ? (
            <T variant="small" style={styles.failed}>
              {t.update.checkFailed}
            </T>
          ) : (
            <View>
              <T variant="small" style={styles.failed}>
                {t.update.checkError}
              </T>
              <Num numberOfLines={2} style={styles.small}>
                {failure}
              </Num>
            </View>
          )
        ) : last ? (
          <View style={styles.lastCheck}>
            <T variant="small">{t.update.upToDate}</T>
            <Num style={styles.small}>{last.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</Num>
          </View>
        ) : undefined
      }
      onPress={check}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingBottom: space.xl },
  sections: { paddingTop: space.lg, gap: space.lg },
  inset: { paddingHorizontal: space.lg },
  onBrand: { color: colors.white },
  // Stretched: shrink-wrapped Nastaliq gets its last word dropped on Android.
  centred: { textAlign: 'center', alignSelf: 'stretch' },
  pendingCount: { color: colors.site, fontSize: 28, lineHeight: 36 },
  // Digits at the small size, muted like T's small variant.
  small: { fontSize: 12, lineHeight: 28, color: colors.muted },
  debug: { fontSize: 12, lineHeight: 28, color: colors.recover },
  failed: { color: colors.recover },
  lastCheck: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
