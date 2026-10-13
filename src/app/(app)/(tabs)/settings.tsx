import { useStatus } from '@powersync/react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePendingUploadCount } from '@/db/hooks';
import { formatDay, toDay } from '@/lib/dates';
import { RELEASE } from '@/release';
import { useMember, useSession } from '@/state/session';
import { lang, type Lang, setLanguage, t } from '@/i18n';
import { Banner } from '@/ui/controls';
import { SettingsRow, SettingsSection } from '@/ui/settings-list';
import { LaserLine, SiteStatus, type SyncState, useProgress } from '@/ui/site-status';
import { XStack, YStack } from '@/ui/tamagui.config';
import { ChoiceDialog } from '@/ui/tamagui-dialog';
import { Digits, Text } from '@/ui/tamagui-text';
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
        <Digits variant="title" bold color="site">
          {pending}
        </Digits>
        <Text variant="title" color="white">
          {t.sync.pending}
        </Text>
      </>
    ) : (
      <Text variant="title" color="white" textAlign="center">
        {!status.hasSynced ? t.sync.firstSync : status.connected ? t.sync.synced : t.sync.offline}
      </Text>
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
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: space.xl }} showsVerticalScrollIndicator={false}>
        <SiteStatus
          business={member.businessName}
          role={t.role[member.role]}
          email={member.email}
          sync={localMode ? undefined : { state: syncState, headline }}
          readouts={readouts}
        />

        <YStack paddingTop="lg" gap="lg">
          {localMode ? (
            <YStack paddingHorizontal="lg">
              <Banner text={t.app.localMode} />
            </YStack>
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
            <Digits variant="small" color="recover" paddingHorizontal="lg">{`download: ${status.downloadError.message}`}</Digits>
          ) : null}
          {!localMode && status.uploadError ? (
            <Digits variant="small" color="recover" paddingHorizontal="lg">{`upload: ${status.uploadError.message}`}</Digits>
          ) : null}

          {!localMode ? (
            <SettingsSection>
              <SettingsRow icon="logout" label={t.auth.signOut} tone="danger" onPress={() => setDialog('signOut')} />
            </SettingsSection>
          ) : null}
        </YStack>
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
            <Digits bold color="brand">{`${Math.round((downloadProgress ?? 0) * 100)}%`}</Digits>
          ) : (
            <ActivityIndicator color={colors.brand} />
          )
        }
      />
    );
    if (!isDownloading) return row;
    // The stage's laser beam again, drawn as far as the download has got.
    return (
      <YStack>
        {row}
        <LaserLine color={colors.owed} scale={progress} />
      </YStack>
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
            <Text variant="small" color="recover">
              {t.update.checkFailed}
            </Text>
          ) : (
            <YStack>
              <Text variant="small" color="recover">
                {t.update.checkError}
              </Text>
              <Digits variant="small" numberOfLines={2}>
                {failure}
              </Digits>
            </YStack>
          )
        ) : last ? (
          <XStack alignItems="center" gap="xs">
            <Text variant="small">{t.update.upToDate}</Text>
            <Digits variant="small">
              {last.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
            </Digits>
          </XStack>
        ) : undefined
      }
      onPress={check}
    />
  );
}
