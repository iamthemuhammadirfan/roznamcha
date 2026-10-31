import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import {
  type AssignmentWithProject,
  balancesByAssignment,
  useWorker,
  useWorkerAssignments,
  useWorkerAttendance,
  useWorkerEntries,
} from '@/db/hooks';
import { changeRate, changeStartDate, endAssignment, reverseEntry, startDateProblem } from '@/db/mutations';
import type { Attendance, LedgerEntry } from '@/db/schema';
import { summarize } from '@/lib/attendance';
import { entryEffects, reversedIds } from '@/lib/balance';
import { formatDay } from '@/lib/dates';
import { parseRupees } from '@/lib/money';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { entryKindLabel, isUrdu, lang, t, tradeLabel } from '@/i18n';
import { StatusCount } from '@/ui/attendance';
import { Attribution, type AttributionInfo, useAttribution } from '@/ui/attribution';
import { BalanceChip } from '@/ui/balance-chip';
import { Banner, Button, Card, Empty, Field, Row, Screen, Tool } from '@/ui/controls';
import { DateField } from '@/ui/date-field';
import { HeaderTitle } from '@/ui/header';
import { CodePlate, SiteBoard } from '@/ui/site-board';
import { WorkerAvatar } from '@/ui/worker-avatar';
import { Money, Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

function EntryRow({
  entry,
  effect,
  reversed,
  canReverse,
  who,
  onReverse,
}: {
  entry: LedgerEntry;
  effect: number;
  reversed: boolean;
  canReverse: boolean;
  who?: AttributionInfo;
  onReverse: () => void;
}) {
  const isCorrection = entry.kind === 'correction';
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/receipt/[id]', params: { id: entry.id } })}
      onLongPress={canReverse && !reversed && !isCorrection ? onReverse : undefined}
      style={({ pressed }) => [styles.entryItem, pressed && { backgroundColor: colors.brandSoft }]}>
      <View style={styles.entry}>
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
      </View>
      <Attribution info={who} />
    </Pressable>
  );
}

function ProjectBlock({
  a,
  entries,
  days,
  balance,
  earned,
}: {
  a: AssignmentWithProject;
  entries: LedgerEntry[];
  days: Attendance[];
  balance: number;
  earned: number;
}) {
  const { role } = useMember();
  const attribute = useAttribution();
  const ctx = useWriteContext();
  const { projectId, setProjectId } = useActiveProject();
  const effects = entryEffects(entries);
  const reversed = reversedIds(entries);
  const [rateDraft, setRateDraft] = useState<string | null>(null);
  const summary = summarize(days);

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

  const [startError, setStartError] = useState<string | null>(null);

  async function pickStart(day: string) {
    if (day === a.started_on) return;
    const problem = await startDateProblem(a.worker_id, a.project_id, day, a.id);
    if (problem) {
      setStartError(
        problem === 'future'
          ? t.assignment.futureStart
          : problem === 'taken'
            ? t.assignment.startTaken
            : t.assignment.startAfterAttendance,
      );
      return;
    }
    setStartError(null);
    Alert.alert(t.assignment.changeStart, t.assignment.changeStartConfirm, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.action.confirm, onPress: () => changeStartDate(a.id, day) },
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
    // Each project block wears its site board, so 489's money is never mistaken for 544's.
    <SiteBoard muted={!a.is_active} style={{ gap: 0 }}>
      <View style={{ gap: space.md }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <CodePlate code={a.project_code} />
          <View style={{ flex: 1 }}>
            <T variant="h2">{a.project_name}</T>
            {!a.is_active ? <T variant="small">{t.assignment.ended}</T> : null}
          </View>
        </Row>
        <BalanceChip paisa={balance} size={22} />
        <View style={styles.stats}>
          <View style={styles.stat}>
            <T variant="small">{t.worker.rate}</T>
            <Money paisa={a.daily_rate_paisa} size={16} />
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <T variant="small">{t.ledger.earned}</T>
            <Money paisa={earned} size={16} />
          </View>
        </View>
        {days.length > 0 ? (
          // Earnings come from these days: a half day pays half the daily wage, absent pays nothing.
          <Row style={{ flexWrap: 'wrap', gap: space.md }}>
            <StatusCount status="full" n={summary.full} />
            <StatusCount status="half" n={summary.half} />
            <StatusCount status="absent" n={summary.absent} />
          </Row>
        ) : null}

        {a.is_active ? (
          <Pressable
            accessibilityRole="button"
            onPress={newEntry}
            style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]}>
            <MaterialCommunityIcons name="hand-coin-outline" size={26} color={colors.white} />
            <T variant="h2" style={{ flex: 1, color: colors.white }}>
              {t.dashboard.giveEntry}
            </T>
          </Pressable>
        ) : null}

        {entries.length === 0 ? <T variant="small">{t.ledger.empty}</T> : null}
        {entries.map((e) => (
          <EntryRow
            key={e.id}
            entry={e}
            effect={effects.get(e.id) ?? 0}
            reversed={reversed.has(e.id)}
            canReverse={role === 'owner'}
            who={attribute?.(e)}
            onReverse={() => confirmReverse(e)}
          />
        ))}

        {/* Set-once details and owner tools sit quietly at the bottom, out of the daily path. */}
        <View style={styles.footer}>
          <DateField
            inline
            disabled={role !== 'owner'}
            label={t.assignment.since}
            value={a.started_on}
            onChange={pickStart}
          />
          {startError ? <Banner tone="recover" text={startError} /> : null}

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
              <Row>
                <Button label={t.action.save} onPress={saveRate} style={{ flex: 1 }} />
                <Button label={t.action.cancel} kind="secondary" onPress={() => setRateDraft(null)} style={{ flex: 1 }} />
              </Row>
            </>
          ) : a.is_active && role === 'owner' ? (
            <Row>
              <Tool icon="cash-edit" label={t.assignment.changeRate} onPress={() => setRateDraft('')} />
              <Tool icon="account-remove-outline" label={t.assignment.end} danger onPress={end} />
            </Row>
          ) : null}
        </View>
      </View>
    </SiteBoard>
  );
}

export default function WorkerDetail() {
  // `projectId` when opened from inside a project: show only that project's ledger.
  const { id, projectId } = useLocalSearchParams<{ id: string; projectId?: string }>();
  const worker = useWorker(id);
  const assignments = useWorkerAssignments(id);
  const entries = useWorkerEntries(id);
  const attendance = useWorkerAttendance(id);
  const balances = balancesByAssignment(attendance, entries);

  if (!worker) return <Empty text={t.worker.notFound} />;

  const grand = assignments.reduce((s, a) => s + (balances.get(a.id)?.balance ?? 0), 0);
  // Scoped only while the worker is still on that project; otherwise the full ledger.
  const scoped = Boolean(projectId) && assignments.some((a) => a.project_id === projectId);
  const shown = scoped ? assignments.filter((a) => a.project_id === projectId) : assignments;
  // Codes of the worker's other projects, once each (a rejoin is a second assignment).
  const otherCodes = scoped
    ? [...new Set(assignments.filter((a) => a.project_id !== projectId).map((a) => a.project_code))]
    : [];

  return (
    <Screen>
      {/* Inside a project the header carries its code, like every other project screen. */}
      {scoped ? <Stack.Screen options={{ headerTitle: () => <HeaderTitle title={t.ledger.title} projectId={projectId} /> }} /> : null}
      <Card style={{ gap: space.md }}>
        <Row style={{ alignItems: 'flex-start' }}>
          <WorkerAvatar name={worker.name_ur} size={64} />
          <View style={{ flex: 1 }}>
            <T variant="h1">{worker.name_ur}</T>
            {worker.father_name ? (
              <T variant="small">
                {t.worker.son} {worker.father_name}
              </T>
            ) : null}
            {worker.trade ? (
              <View style={styles.trade}>
                <T variant="small" style={{ color: colors.brand }}>
                  {tradeLabel(worker.trade)}
                </T>
              </View>
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.action.edit}
            hitSlop={12}
            onPress={() => router.push({ pathname: '/worker-form', params: { id } })}
            style={styles.iconButton}>
            <MaterialCommunityIcons name="pencil-outline" size={24} color={colors.brand} />
          </Pressable>
        </Row>
        {worker.phone ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.worker.call}
            onPress={() => Linking.openURL(`tel:${worker.phone}`)}
            style={({ pressed }) => [styles.call, pressed && { backgroundColor: colors.brandSoft }]}>
            <MaterialCommunityIcons name="phone-outline" size={24} color={colors.brand} />
            <Num style={{ flex: 1, fontSize: 18 }}>{worker.phone}</Num>
            <T variant="bodyBold" style={{ color: colors.brand }}>
              {t.worker.call}
            </T>
          </Pressable>
        ) : null}
      </Card>

      {assignments.length === 0 ? <Empty text={t.worker.noProjects} /> : null}
      {/* Each project is its own ledger. Money on 489 never nets against wages on 544. */}
      {shown.map((a) => (
        <ProjectBlock
          key={a.id}
          a={a}
          entries={entries.filter((e) => e.assignment_id === a.id)}
          days={attendance.filter((d) => d.assignment_id === a.id)}
          balance={balances.get(a.id)?.balance ?? 0}
          earned={balances.get(a.id)?.earned ?? 0}
        />
      ))}

      {otherCodes.length > 0 ? (
        // The rest of the worker's ledger, one tap away but out of this project's way.
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/worker/[id]', params: { id } })}
          style={({ pressed }) => [styles.others, pressed && { backgroundColor: colors.brandSoft }]}>
          <MaterialCommunityIcons name="briefcase-outline" size={22} color={colors.brand} />
          <T variant="bodyBold" style={{ flex: 1, color: colors.brand }}>
            {t.ledger.otherProjects}
          </T>
          {otherCodes.map((code) => (
            <Num key={code} bold style={styles.otherCode}>
              {code}
            </Num>
          ))}
          {/* Forced RTL mirrors the layout but not the glyph, so pick the one that points inward. */}
          <MaterialCommunityIcons name={isUrdu ? 'chevron-left' : 'chevron-right'} size={24} color={colors.brand} />
        </Pressable>
      ) : null}

      {!scoped && assignments.length > 1 ? (
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
  entryItem: {
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  entry: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
    gap: space.sm,
  },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
  trade: { alignSelf: 'flex-start', backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: space.md },
  iconButton: { padding: space.xs },
  stats: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: colors.bg,
    paddingVertical: space.sm,
  },
  stat: { flex: 1, alignItems: 'center' },
  statDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  primary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 60,
    borderRadius: 12,
    backgroundColor: colors.brand,
    paddingHorizontal: space.lg,
  },
  footer: {
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.sm,
  },
  others: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
  },
  otherCode: {
    color: colors.siteInk,
    backgroundColor: colors.site,
    borderRadius: 6,
    paddingHorizontal: space.sm,
    overflow: 'hidden',
  },
  call: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.md,
  },
});
