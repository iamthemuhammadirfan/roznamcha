import * as Updates from 'expo-updates';

import { useRejectedWrites } from '@/db/hooks';
import { dismissRejected } from '@/db/mutations';
import { t } from '@/i18n';

import { Button, Card, Row } from './controls';
import { Num, T } from './text';
import { colors } from './theme';

/** "New version ready — restart", shown once an OTA update has downloaded. */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  if (!isUpdatePending) return null;
  return (
    <Card style={{ backgroundColor: colors.brandSoft }}>
      <T variant="bodyBold">{t.settings.updateReady}</T>
      <Button label={t.settings.restart} onPress={() => Updates.reloadAsync()} />
    </Card>
  );
}

/** Uploads the server rejected (RLS, constraints) — never dropped silently. */
export function NotSaved() {
  const rejected = useRejectedWrites();
  if (rejected.length === 0) return null;
  return (
    <Card style={{ borderColor: colors.recover, borderWidth: 2 }}>
      <Row>
        <Num bold style={{ color: colors.recover }}>
          {rejected.length}
        </Num>
        <T variant="h2" style={{ color: colors.recover }}>
          {t.dashboard.notSaved}
        </T>
      </Row>
      <T variant="small">{t.dashboard.notSavedHelp}</T>
      {rejected.map((r) => (
        <Row key={r.id} style={{ justifyContent: 'space-between' }}>
          <Num style={{ fontSize: 13, flexShrink: 1 }} numberOfLines={2}>
            {r.table_name} {r.op} · {r.error}
          </Num>
          <T variant="small" style={{ color: colors.brand }} onPress={() => dismissRejected(r.id)}>
            {t.dashboard.dismiss}
          </T>
        </Row>
      ))}
    </Card>
  );
}
