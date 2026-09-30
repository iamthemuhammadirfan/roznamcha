import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { useProject, useWorker } from '@/db/hooks';
import { activeAssignment, assignWorker } from '@/db/mutations';
import { parseRupees } from '@/lib/money';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { t } from '@/i18n';
import { Banner, Button, Card, Field, Row, Screen } from '@/ui/controls';
import { Num, T } from '@/ui/text';
import { colors } from '@/ui/theme';

/** Step two of "add worker": the person exists; give them a rate on this project. */
export default function Assign() {
  const { workerId } = useLocalSearchParams<{ workerId: string }>();
  const { projectId } = useActiveProject();
  const worker = useWorker(workerId);
  const project = useProject(projectId ?? null);
  const ctx = useWriteContext();
  const { role } = useMember();
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    const paisa = parseRupees(rate);
    if (!paisa) return setError(t.assignment.rateRequired);
    if (!projectId) return;
    if (await activeAssignment(workerId, projectId)) return setError(t.assignment.alreadyOn);
    setBusy(true);
    await assignWorker(ctx, workerId, projectId, paisa);
    router.dismissTo('/project-workers');
  }

  return (
    <Screen>
      <Card>
        <T variant="h1">{worker?.name_ur}</T>
        {worker?.father_name ? (
          <T variant="small">
            {t.worker.son} {worker.father_name}
          </T>
        ) : null}
        <Row>
          <Num bold style={{ fontSize: 22, color: colors.brand }}>
            {project?.code}
          </Num>
          <T variant="h2">{project?.name_ur}</T>
        </Row>
      </Card>
      {role !== 'owner' ? (
        // RLS would reject this upload anyway; say so now rather than after sync.
        <Banner tone="recover" text={t.assignment.ownerOnly} />
      ) : (
        <>
          {error ? <Banner tone="recover" text={error} /> : null}
          <Field label={t.assignment.rate} value={rate} onChangeText={setRate} numeric autoFocus />
          <Button label={t.assignment.save} onPress={save} busy={busy} />
        </>
      )}
    </Screen>
  );
}
