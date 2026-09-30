import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  type AssignmentWithProject,
  balancesByAssignment,
  useWorker,
  useWorkerAssignments,
  useWorkerAttendance,
  useWorkerEntries,
} from '@/db/hooks';
import { changeRate, endAssignment, reverseEntry } from '@/db/mutations';
import type { LedgerEntry } from '@/db/schema';
import { entryEffects, reversedIds } from '@/lib/balance';
import { formatDay } from '@/lib/dates';
import { parseRupees } from '@/lib/money';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { entryKindLabel, lang, t, tradeLabel } from '@/i18n';
import { BalanceChip } from '@/ui/balance-chip';
import { Button, Card, Empty, Field, Phone, Row, Screen } from '@/ui/controls';
import { Money, Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

function EntryRow({
  entry,
  effect,
  reversed,
  canReverse,
  onReverse,
}: {
  entry: LedgerEntry;
  effect: number;
  reversed: boolean;
  canReverse: boolean;
  onReverse: () => void;
}) {
  const isCorrection = entry.kind === 'correction';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: entry.id } })}
      onLongPress={canReverse && !reversed && !isCorrection ? onReverse : undefined}
      style={({ pressed }) => [styles.entry, pressed && { backgroundColor: colors.brandSoft }]}>
      <View style={{ flexShrink: 1 }}>
        <Row>
          <T variant="bodyBold" style={[reversed && styles.struck, isCorrection && { color: colors.pending }]}>
            {entryKindLabel(entry.kind)}
          </T>
          <T variant="small">{formatDay(entry.date, lang)}</T>
        </Row>
        <Row>
          <Num style={{ fontSize: 13, color: colors.muted }}>{entry.ref_code}</Num>
          {isCorrection && entry.note_ur ? (
            <T variant="small">
              {t.entry.reverses} <Num style={{ fontSize: 13 }}>{entry.note_ur}</Num>
            </T>
          ) : entry.note_ur ? (
            <T variant="small">{entry.note_ur}</T>
          ) : null}
        </Row>
        <T variant="small" style={{ color: entry.receipt_sent_at ? colors.owed : colors.pending }}>
          {reversed ? t.entry.reversed : entry.receipt_sent_at ? t.entry.receiptSent : t.entry.receiptPending}
        </T>
      </View>
      <Money paisa={entry.amount_paisa} color={effect >= 0 ? colors.owed : colors.recover} />
    </Pressable>
  );
}

function ProjectBlock({
  a,
  entries,
  balance,
  earned,
}: {
  a: AssignmentWithProject;
  entries: LedgerEntry[];
  balance: number;
  earned: number;
}) {
  const { role } = useMember();
  const ctx = useWriteContext();
  const { projectId, setProjectId } = useActiveProject();
  const effects = entryEffects(entries);
  const reversed = reversedIds(entries);
  const [rateDraft, setRateDraft] = useState<string | null>(null);

  async function saveRate() {
    const paisa = rateDraft ? parseRupees(rateDraft) : null;
    if (!paisa) return Alert.alert(t.assignment.rateRequired);
    await changeRate(a.id, paisa);
    setRateDraft(null);
  }

  function confirmReverse(e: LedgerEntry) {
    Alert.alert(t.entry.reverse, `${t.entry.reverseConfirm}\n\n${e.ref_code}`, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.action.confirm, style: 'destructive', onPress: () => reverseEntry(ctx, e) },
    ]);
  }

  function newEntry() {
    // The entry screen is scoped to the active project; switch explicitly so the header
    // shows which project this money is going against.
    if (projectId !== a.project_id) setProjectId(a.project_id);
    router.push({ pathname: '/entry', params: { workerId: a.worker_id } });
  }

  function end() {
    Alert.alert(t.assignment.end, t.assignment.endConfirm, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.action.confirm, style: 'destructive', onPress: () => endAssignment(a.id) },
    ]);
  }

  return (
    <Card style={{ gap: space.md }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <Num bold style={{ fontSize: 24, lineHeight: 36, color: colors.brand }}>
            {a.project_code}
          </Num>
          <T variant="h2">{a.project_name}</T>
        </Row>
        {!a.is_active ? <T variant="small">{t.assignment.ended}</T> : null}
      </Row>
      <Row style={{ justifyContent: 'space-between' }}>
        <Row>
          <T variant="small">{t.worker.rate}</T>
          <Money paisa={a.daily_rate_paisa} size={15} color={colors.muted} />
        </Row>
        {earned > 0 ? (
          <Row>
            <T variant="small">{t.ledger.earned}</T>
            <Money paisa={earned} size={15} color={colors.muted} />
          </Row>
        ) : null}
      </Row>
      <BalanceChip paisa={balance} size={20} />

      {entries.length === 0 ? <T variant="small">{t.ledger.empty}</T> : null}
      {entries.map((e) => (
        <EntryRow
          key={e.id}
          entry={e}
          effect={effects.get(e.id) ?? 0}
          reversed={reversed.has(e.id)}
          canReverse={role === 'owner'}
          onReverse={() => confirmReverse(e)}
        />
      ))}

      {a.is_active ? <Button label={t.dashboard.giveEntry} onPress={newEntry} /> : null}
      {a.is_active && role === 'owner' && rateDraft === null ? (
        <Button label={t.assignment.changeRate} kind="secondary" onPress={() => setRateDraft('')} />
      ) : null}
      {rateDraft !== null ? (
        <>
          <Field
            label={t.assignment.rate}
            hint={t.assignment.changeRateHelp}
            value={rateDraft}
            onChangeText={setRateDraft}
            numeric
            autoFocus
          />
          <Button label={t.action.save} onPress={saveRate} />
          <Button label={t.action.cancel} kind="secondary" onPress={() => setRateDraft(null)} />
        </>
      ) : null}
      {a.is_active && role === 'owner' ? <Button label={t.assignment.end} kind="secondary" onPress={end} /> : null}
    </Card>
  );
}

export default function WorkerDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const worker = useWorker(id);
  const assignments = useWorkerAssignments(id);
  const entries = useWorkerEntries(id);
  const balances = balancesByAssignment(useWorkerAttendance(id), entries);

  if (!worker) return <Empty text={t.worker.notFound} />;

  const grand = assignments.reduce((s, a) => s + (balances.get(a.id)?.balance ?? 0), 0);

  return (
    <Screen>
      <Card onPress={() => router.push({ pathname: '/worker-form', params: { id } })}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flexShrink: 1 }}>
            <T variant="h1">{worker.name_ur}</T>
            {worker.father_name ? (
              <T variant="small">
                {t.worker.son} {worker.father_name}
              </T>
            ) : null}
            <Phone value={worker.phone} />
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            {worker.trade ? <T variant="small">{tradeLabel(worker.trade)}</T> : null}
            <T variant="small" style={{ color: colors.brand }}>
              {t.action.edit}
            </T>
          </View>
        </Row>
      </Card>

      {assignments.length === 0 ? <Empty text={t.worker.noProjects} /> : null}
      {/* Each project is its own ledger. Money on 489 never nets against wages on 544. */}
      {assignments.map((a) => (
        <ProjectBlock
          key={a.id}
          a={a}
          entries={entries.filter((e) => e.assignment_id === a.id)}
          balance={balances.get(a.id)?.balance ?? 0}
          earned={balances.get(a.id)?.earned ?? 0}
        />
      ))}

      {assignments.length > 1 ? (
        <Card style={{ backgroundColor: colors.brandSoft }}>
          <T variant="h2">{t.ledger.grandTotal}</T>
          <BalanceChip paisa={grand} size={22} />
          <T variant="small">{t.ledger.grandTotalHelp}</T>
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 64,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
});
