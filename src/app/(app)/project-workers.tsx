import { router } from 'expo-router';
import { View } from 'react-native';

import { balancesByAssignment, useProjectAssignments, useProjectAttendance, useProjectEntries } from '@/db/hooks';
import { useActiveProject } from '@/state/active-project';
import { ur } from '@/strings.ur';
import { BalanceChip } from '@/ui/balance-chip';
import { Button, Card, Empty, Phone, Row, Screen } from '@/ui/controls';
import { Money, T } from '@/ui/text';
import { colors, TOUCH_MIN } from '@/ui/theme';

export default function WorkersOnProject() {
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const assignments = useProjectAssignments(pid);
  const balances = balancesByAssignment(useProjectAttendance(pid), useProjectEntries(pid));

  const active = assignments.filter((a) => a.is_active);
  const ended = assignments.filter((a) => !a.is_active);

  return (
    <Screen>
      {/* Always search the directory first so an existing person is reused, not duplicated. */}
      <Button label={ur.action.addWorker} onPress={() => router.push('/add-worker')} />
      {active.length === 0 ? <Empty text={ur.worker.notFound} /> : null}
      {[...active, ...ended].map((a) => (
        <Card
          key={a.id}
          onPress={() => router.push({ pathname: '/worker/[id]', params: { id: a.worker_id } })}
          style={{ minHeight: TOUCH_MIN, opacity: a.is_active ? 1 : 0.6 }}>
          <Row style={{ justifyContent: 'space-between' }}>
            <View style={{ flexShrink: 1 }}>
              <T variant="h2" style={{ fontSize: 20 }}>
                {a.worker_name}
              </T>
              <Row>
                {a.worker_father_name ? (
                  <T variant="small">
                    {ur.worker.son} {a.worker_father_name}
                  </T>
                ) : null}
                {a.worker_trade ? <T variant="small">· {a.worker_trade}</T> : null}
              </Row>
              <Phone value={a.worker_phone} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <BalanceChip paisa={balances.get(a.id)?.balance ?? 0} />
              <Row>
                <T variant="small">{ur.worker.rate}</T>
                <Money paisa={a.daily_rate_paisa} size={14} color={colors.muted} />
              </Row>
              {!a.is_active ? <T variant="small">{ur.assignment.ended}</T> : null}
            </View>
          </Row>
        </Card>
      ))}
    </Screen>
  );
}
