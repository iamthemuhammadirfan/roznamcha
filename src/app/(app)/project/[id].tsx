import { router, useLocalSearchParams } from 'expo-router';

import {
  balancesByAssignment,
  useProject,
  useProjectAssignments,
  useProjectAttendance,
  useProjectEntries,
} from '@/db/hooks';
import { activeOn, coverage } from '@/lib/attendance';
import { today } from '@/lib/dates';
import { useSession } from '@/state/session';
import { isUrdu, t } from '@/i18n';
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
  const attendance = useProjectAttendance(id);
  const balances = balancesByAssignment(attendance, useProjectEntries(id));

  if (!project) return <Empty text={t.project.empty} />;

  const outstanding = assignments.reduce((s, a) => s + (balances.get(a.id)?.balance ?? 0), 0);
  const active = assignments.filter((a) => a.is_active).length;

  const day = today();
  const expected = assignments.filter((a) => activeOn(a, day));
  const markedToday = new Set(attendance.filter((r) => r.date === day).map((r) => r.assignment_id));
  const marked = expected.filter((a) => markedToday.has(a.id)).length;
  const todayState = coverage(expected.length, marked);

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
      <Button label={t.dashboard.markAttendance} kind="secondary" onPress={() => router.push('/attendance')} />

      {expected.length > 0 ? (
        <Card
          onPress={() => router.push({ pathname: '/attendance-day', params: { date: day } })}
          style={{ backgroundColor: todayState === 'complete' ? colors.owedSoft : colors.pendingSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="h2">{t.dashboard.todayAttendance}</T>
            {todayState === 'missing' ? (
              <T variant="bodyBold" style={{ color: colors.pending }}>
                {t.attendance.notMarked}
              </T>
            ) : (
              // Urdu reads "15 میں سے 12" (12 out of 15); English "12 of 15".
              <Row>
                <Num bold style={{ fontSize: 20 }}>
                  {isUrdu ? expected.length : marked}
                </Num>
                <T variant="small">{t.attendance.of}</T>
                <Num bold style={{ fontSize: 20 }}>
                  {isUrdu ? marked : expected.length}
                </Num>
                <T variant="small">{t.attendance.marked}</T>
              </Row>
            )}
          </Row>
        </Card>
      ) : null}

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
