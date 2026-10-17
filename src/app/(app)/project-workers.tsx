import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  type AssignmentWithWorker,
  balancesByAssignment,
  useProjectAssignments,
  useProjectAttendance,
  useProjectEntries,
} from '@/db/hooks';
import { useActiveProject } from '@/state/active-project';
import { t, tradeLabel } from '@/i18n';
import { BalanceChip } from '@/ui/balance-chip';
import { Button, Empty, Phone, Row, Screen } from '@/ui/controls';
import { Money, T } from '@/ui/text';
import { colors, space, TOUCH_MIN } from '@/ui/theme';
import { WorkerAvatar } from '@/ui/worker-avatar';

export default function WorkersOnProject() {
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const assignments = useProjectAssignments(pid);
  const balances = balancesByAssignment(useProjectAttendance(pid), useProjectEntries(pid));

  const active = assignments.filter((a) => a.is_active);
  const ended = assignments.filter((a) => !a.is_active);

  return (
    // Adding goes through the directory first, so an existing person is reused, not duplicated.
    <Screen
      footer={<Button icon="account-plus-outline" label={t.action.addWorker} onPress={() => router.push('/add-worker')} />}>

      {active.length === 0 ? <Empty text={t.worker.notFound} /> : null}
      {active.map((a) => (
        <WorkerRow key={a.id} a={a} balance={balances.get(a.id)?.balance ?? 0} />
      ))}

      {ended.length > 0 ? (
        <>
          <T variant="bodyBold" style={{ paddingHorizontal: space.xs }}>
            {t.assignment.ended}
          </T>
          {ended.map((a) => (
            <WorkerRow key={a.id} a={a} balance={balances.get(a.id)?.balance ?? 0} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

function WorkerRow({ a, balance }: { a: AssignmentWithWorker; balance: number }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/worker/[id]', params: { id: a.worker_id, projectId: a.project_id } })}
      style={({ pressed }) => [styles.row, !a.is_active && { opacity: 0.6 }, pressed && { backgroundColor: colors.brandSoft }]}>
      <Row style={{ alignItems: 'flex-start' }}>
        <WorkerAvatar name={a.worker_name} />
        <View style={{ flex: 1 }}>
          <T variant="h2" style={{ fontSize: 20 }}>
            {a.worker_name}
          </T>
          {a.worker_father_name ? (
            <T variant="small">
              {t.worker.son} {a.worker_father_name}
            </T>
          ) : null}
          <Phone value={a.worker_phone} />
        </View>
        {a.worker_trade ? (
          <View style={styles.trade}>
            <T variant="small" style={{ color: colors.brand }}>
              {tradeLabel(a.worker_trade)}
            </T>
          </View>
        ) : null}
      </Row>
      <Row style={styles.foot}>
        <Row style={{ flex: 1, gap: space.xs }}>
          <T variant="small">{t.worker.rate}</T>
          <Money paisa={a.daily_rate_paisa} size={15} color={colors.muted} />
        </Row>
        <BalanceChip paisa={balance} />
      </Row>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: TOUCH_MIN,
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
  },
  trade: { backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: space.md },
  foot: {
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.sm,
  },
});
