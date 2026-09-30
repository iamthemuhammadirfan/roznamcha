import { useStatus } from '@powersync/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

import { usePendingUploadCount } from '@/db/hooks';
import { useMember, useSession } from '@/state/session';
import { lang, type Lang, setLanguage, t } from '@/i18n';
import { Banner, Button, Card, Choice, Row, Screen } from '@/ui/controls';
import { Num, T } from '@/ui/text';
import { colors } from '@/ui/theme';

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

  function confirmSignOut() {
    Alert.alert(t.auth.signOut, t.auth.signOutConfirm, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.auth.signOut, style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Screen>
      {localMode ? <Banner text={t.app.localMode} /> : null}
      <Card>
        <T variant="small">{t.settings.language}</T>
        <Choice options={LANGUAGES} value={lang} onChange={(next) => next !== lang && setLanguage(next)} />
        <T variant="small">{t.settings.languageHelp}</T>
      </Card>

      <Card>
        <T variant="small">{t.settings.business}</T>
        <T variant="h2">{member.businessName}</T>
        <T variant="small">{t.settings.account}</T>
        <Row>
          {member.email ? <Num>{member.email}</Num> : null}
          <T variant="bodyBold">{t.role[member.role]}</T>
        </Row>
      </Card>

      {!localMode ? (
        <Card>
          <T variant="small">{t.settings.sync}</T>
          <T variant="bodyBold">{status.connected ? t.sync.synced : t.sync.offline}</T>
          <Row>
            <Num bold>{pending}</Num>
            <T>{t.sync.pending}</T>
          </Row>
          {!status.hasSynced ? <T variant="small">{t.sync.firstSync}</T> : null}
          {/* Shown in Urdu-agnostic form on purpose: this is for whoever is debugging. */}
          {status.downloadError ? (
            <Num style={{ fontSize: 12, color: colors.recover }}>{`download: ${status.downloadError.message}`}</Num>
          ) : null}
          {status.uploadError ? (
            <Num style={{ fontSize: 12, color: colors.recover }}>{`upload: ${status.uploadError.message}`}</Num>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <T variant="small">{t.settings.version}</T>
        <Row>
          <Num>{Constants.expoConfig?.version}</Num>
          {Updates.updateId ? <Num style={{ fontSize: 12 }}>{Updates.updateId.slice(0, 8)}</Num> : null}
        </Row>
        {isUpdatePending ? <Button label={t.settings.restart} onPress={() => Updates.reloadAsync()} /> : null}
      </Card>

      {!localMode ? <Button label={t.auth.signOut} kind="danger" onPress={confirmSignOut} /> : null}
    </Screen>
  );
}
