import { useStatus } from '@powersync/react-native';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

import { usePendingUploadCount } from '@/db/hooks';
import { useMember, useSession } from '@/state/session';
import { ur } from '@/strings.ur';
import { Banner, Button, Card, Row, Screen } from '@/ui/controls';
import { Num, T } from '@/ui/text';
import { colors } from '@/ui/theme';

export default function Settings() {
  const { localMode, signOut } = useSession();
  const member = useMember();
  const status = useStatus();
  const pending = usePendingUploadCount();
  const { isUpdatePending } = Updates.useUpdates();

  function confirmSignOut() {
    Alert.alert(ur.auth.signOut, ur.auth.signOutConfirm, [
      { text: ur.action.cancel, style: 'cancel' },
      { text: ur.auth.signOut, style: 'destructive', onPress: signOut },
    ]);
  }

  return (
    <Screen>
      {localMode ? <Banner text={ur.app.localMode} /> : null}
      <Card>
        <T variant="small">{ur.settings.business}</T>
        <T variant="h2">{member.businessName}</T>
        <T variant="small">{ur.settings.account}</T>
        <Row>
          {member.email ? <Num>{member.email}</Num> : null}
          <T variant="bodyBold">{ur.role[member.role]}</T>
        </Row>
      </Card>

      {!localMode ? (
        <Card>
          <T variant="small">{ur.settings.sync}</T>
          <T variant="bodyBold">{status.connected ? ur.sync.synced : ur.sync.offline}</T>
          <Row>
            <Num bold>{pending}</Num>
            <T>{ur.sync.pending}</T>
          </Row>
          {!status.hasSynced ? <T variant="small">{ur.sync.firstSync}</T> : null}
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
        <T variant="small">{ur.settings.version}</T>
        <Row>
          <Num>{Constants.expoConfig?.version}</Num>
          {Updates.updateId ? <Num style={{ fontSize: 12 }}>{Updates.updateId.slice(0, 8)}</Num> : null}
        </Row>
        {isUpdatePending ? <Button label={ur.settings.restart} onPress={() => Updates.reloadAsync()} /> : null}
      </Card>

      {!localMode ? <Button label={ur.auth.signOut} kind="danger" onPress={confirmSignOut} /> : null}
    </Screen>
  );
}
