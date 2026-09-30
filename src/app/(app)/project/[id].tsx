import { router, useLocalSearchParams } from 'expo-router';

import {
  balancesByAssignment,
  useProject,
  useProjectAssignments,
  useProjectAttendance,
  useProjectEntries,
} from '@/db/hooks';
import { useSession } from '@/state/session';
import { t } from '@/i18n';
import { BalanceChip } from '@/ui/balance-chip';
import { Banner, Button, Card, Empty, Row, Screen } from '@/ui/controls';
import { Num, T } from '@/ui/text';
import { colors } from '@/ui/theme';

/**
 * One project's dashboard, pushed from the project list on Home. Back returns to the
 * list. The list sets this as the active project before opening it, so the header,
 * new entries and assignments are all scoped to it.
 */
export default function ProjectDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { localMode } = useSession();
  const project = useProject(id);
  const assignments = useProjectAssignments(id);
  const balances = balancesByAssignment(useProjectAttendance(id), useProjectEntries(id));

  if (!project) return <Empty text={t.project.empty} />;

  const outstanding = assignments.reduce((s, a) => s + (balances.get(a.id)?.balance ?? 0), 0);
  const active = assignments.filter((a) => a.is_active).length;

  return (
    <Screen>
      {localMode ? <Banner text={t.app.localMode} /> : null}

      <Card>
        <Row>
          <Num bold style={{ fontSize: 32, lineHeight: 46, color: colors.brand }}>
            {project.code}
          </Num>
          <T variant="h1">{project.name_ur}</T>
        </Row>
        {project.address ? <T variant="small">{project.address}</T> : null}
        <T variant="small">{t.balance.total}</T>
        <BalanceChip paisa={outstanding} size={22} />
      </Card>

      <Button label={t.dashboard.giveEntry} onPress={() => router.push('/entry')} style={{ minHeight: 80 }} />
      <Button label={`${t.dashboard.markAttendance} — ${t.dashboard.comingSoon}`} kind="secondary" disabled />

      <Card onPress={() => router.push('/project-workers')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="h2">{t.dashboard.workersOnProject}</T>
          <Num bold style={{ fontSize: 22 }}>
            {active}
          </Num>
        </Row>
      </Card>
    </Screen>
  );
}
