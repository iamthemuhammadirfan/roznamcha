import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AssignmentWithWorker, useProjectAssignments, useProjectAttendance } from '@/db/hooks';
import { saveAttendance } from '@/db/mutations';
import type { Attendance } from '@/db/schema';
import { activeOn, type DayStatus, nextStatus, summarize } from '@/lib/attendance';
import { attendanceEarning } from '@/lib/balance';
import { daysBetween, formatDay, today, weekday } from '@/lib/dates';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { lang, t } from '@/i18n';
import { STATUS_STYLE, StatusCount, statusLabel } from '@/ui/attendance';
import { Banner, Button, Card, Empty, Row } from '@/ui/controls';
import { Money, Num, T } from '@/ui/text';
import { colors, space, TOUCH_MIN } from '@/ui/theme';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Overtime is a full day plus hours; the marking screen shows it as full. */
function asDayStatus(s: string): DayStatus {
  return s === 'half' || s === 'absent' ? s : 'full';
}

/**
 * One day's haazri for the active project. Everyone opens pre-marked present — absence
 * is the exception, so the munshi only taps the few who were half day or away.
 */
export default function AttendanceDay() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date && DAY.test(params.date) ? params.date : today();
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const { role } = useMember();
  const ctx = useWriteContext();

  const assignments = useProjectAssignments(pid);
  const existing = new Map<string, Attendance>();
  for (const r of useProjectAttendance(pid)) if (r.date === date) existing.set(r.assignment_id, r);

  // Only people on the project that day, plus anyone already marked on it.
  const people = assignments.filter((a) => activeOn(a, date) || existing.has(a.id));

  const [draft, setDraft] = useState<Record<string, DayStatus>>({});
  const [busy, setBusy] = useState(false);

  const back = daysBetween(date, today());
  // The server lets a munshi change attendance only within 7 days; don't offer an edit
  // it would reject. Unmarked days can still be filled in.
  const lockedOld = role !== 'owner' && back > 7;

  function statusOf(a: AssignmentWithWorker): DayStatus {
    const saved = existing.get(a.id);
    return draft[a.id] ?? (saved ? asDayStatus(saved.status) : 'full');
  }

  function rateOf(a: AssignmentWithWorker) {
    return existing.get(a.id)?.rate_applied_paisa ?? a.daily_rate_paisa;
  }

  function isLocked(a: AssignmentWithWorker) {
    return lockedOld && existing.has(a.id);
  }

  const changes = people.filter((a) => {
    if (isLocked(a)) return false;
    const saved = existing.get(a.id);
    return !saved || asDayStatus(saved.status) !== statusOf(a);
  });

  const marks = people.map((a) => ({ status: statusOf(a) }));
  const summary = summarize(marks);
  const wages = people.reduce(
    (s, a) => s + attendanceEarning({ status: statusOf(a), rate_applied_paisa: rateOf(a), overtime_hours: 0 }),
    0,
  );

  function tap(a: AssignmentWithWorker) {
    if (isLocked(a)) return Alert.alert(t.attendance.lockedOld);
    setDraft((d) => ({ ...d, [a.id]: nextStatus(statusOf(a)) }));
  }

  async function commit() {
    setBusy(true);
    try {
      await saveAttendance(
        ctx,
        date,
        changes.map((a) => ({ assignmentId: a.id, status: statusOf(a) })),
      );
      router.back();
    } catch (e) {
      setBusy(false);
      Alert.alert(t.common.error, String(e));
    }
  }

  function save() {
    if (back < 0) return Alert.alert(t.attendance.futureDay);
    if (back > 7) {
      Alert.alert(t.entry.backdateTitle, t.entry.backdateBody, [
        { text: t.action.cancel, style: 'cancel' },
        { text: t.action.confirm, onPress: commit },
      ]);
      return;
    }
    commit();
  }

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Card style={{ backgroundColor: colors.brandSoft }}>
        <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <T variant="h2">{weekday(date, lang)}</T>
          <Num bold style={{ fontSize: 20 }}>
            {formatDay(date, lang)}
          </Num>
        </Row>
        <Row style={{ flexWrap: 'wrap', gap: space.md }}>
          <StatusCount status="full" n={summary.full} />
          <StatusCount status="half" n={summary.half} />
          <StatusCount status="absent" n={summary.absent} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small">{t.attendance.dayWages}</T>
          <Money paisa={wages} size={20} />
        </Row>
      </Card>
      {people.length > 0 ? <T variant="small">{t.attendance.tapHelp}</T> : null}
      {lockedOld ? <Banner text={t.attendance.lockedOld} /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <FlatList
        data={people}
        keyExtractor={(a) => a.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty text={t.attendance.noWorkers} />}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item: a }) => {
          const status = statusOf(a);
          const { fg, bg } = STATUS_STYLE[status];
          const unsaved = changes.includes(a);
          return (
            <Pressable
              onPress={() => tap(a)}
              accessibilityRole="button"
              accessibilityLabel={`${a.worker_name}, ${statusLabel(status)}`}
              style={({ pressed }) => [
                styles.row,
                unsaved && styles.unsaved,
                isLocked(a) && { opacity: 0.6 },
                pressed && { opacity: 0.7 },
              ]}>
              <View style={{ flexShrink: 1 }}>
                <T variant="h2" style={{ fontSize: 20 }}>
                  {a.worker_name}
                </T>
                {a.worker_father_name ? (
                  <T variant="small">
                    {t.worker.son} {a.worker_father_name}
                  </T>
                ) : null}
                {unsaved ? (
                  <T variant="small" style={{ color: colors.pending }}>
                    {t.attendance.notSavedYet}
                  </T>
                ) : null}
              </View>
              <View style={{ alignItems: 'flex-end', gap: 2 }}>
                <View style={[styles.pill, { backgroundColor: bg, borderColor: fg }]}>
                  <T variant="bodyBold" style={{ color: fg }}>
                    {statusLabel(status)}
                  </T>
                </View>
                <Money
                  paisa={attendanceEarning({ status, rate_applied_paisa: rateOf(a), overtime_hours: 0 })}
                  size={15}
                  color={colors.muted}
                />
              </View>
            </Pressable>
          );
        }}
      />
      {people.length > 0 ? (
        <View style={styles.footer}>
          <Button
            // No count in the label: digits inside an Urdu string get reordered by bidi.
            label={changes.length > 0 ? t.attendance.save : t.attendance.saved}
            onPress={save}
            busy={busy}
            disabled={changes.length === 0}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, flexGrow: 1 },
  row: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  unsaved: { borderColor: colors.pending, borderStyle: 'dashed', borderWidth: 2 },
  pill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: space.md, minWidth: 96, alignItems: 'center' },
  footer: {
    padding: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
