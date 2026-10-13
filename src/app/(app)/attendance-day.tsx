import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AssignmentWithWorker, useProjectAssignments, useProjectAttendance } from '@/db/hooks';
import { saveAttendance } from '@/db/mutations';
import type { Attendance } from '@/db/schema';
import { activeOn, type DayStatus, summarize } from '@/lib/attendance';
import { attendanceEarning } from '@/lib/balance';
import { daysBetween, formatDay, today, weekday } from '@/lib/dates';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { lang, t } from '@/i18n';
import { StatusCount, StatusPicker } from '@/ui/attendance';
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

  function set(a: AssignmentWithWorker, status: DayStatus) {
    if (isLocked(a)) return Alert.alert(t.attendance.lockedOld);
    setDraft((d) => ({ ...d, [a.id]: status }));
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
      <Card>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={styles.datePlate}>
            <Num bold style={{ fontSize: 26, lineHeight: 34, color: colors.siteInk }}>
              {Number(date.slice(8))}
            </Num>
          </View>
          <View style={{ flex: 1 }}>
            <T variant="h2">{weekday(date, lang)}</T>
            <T variant="small">{formatDay(date, lang)}</T>
          </View>
        </Row>
        <Row style={{ flexWrap: 'wrap', gap: space.md }}>
          <StatusCount status="full" n={summary.full} />
          <StatusCount status="half" n={summary.half} />
          <StatusCount status="absent" n={summary.absent} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small" style={{ flex: 1 }}>
            {t.attendance.dayWages}
          </T>
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
          // Only rows the munshi touched; an unmarked day's default "present" is covered by
          // the footer count, so a fresh sheet isn't striped from top to bottom.
          const edited = a.id in draft && changes.includes(a);
          return (
            <View style={[styles.row, edited && styles.unsaved, isLocked(a) && { opacity: 0.6 }]}>
              <View style={{ flex: 1 }}>
                <T variant="h2" style={{ fontSize: 20 }}>
                  {a.worker_name}
                </T>
                {a.worker_father_name ? (
                  <T variant="small">
                    {t.worker.son} {a.worker_father_name}
                  </T>
                ) : null}
                <Money
                  paisa={attendanceEarning({ status, rate_applied_paisa: rateOf(a), overtime_hours: 0 })}
                  size={14}
                  color={colors.muted}
                />
              </View>
              <StatusPicker value={status} onChange={(s) => set(a, s)} disabled={isLocked(a)} />
            </View>
          );
        }}
      />
      {people.length > 0 ? (
        <View style={styles.footer}>
          {changes.length > 0 ? (
            <Row style={{ justifyContent: 'center' }}>
              <Num bold style={{ color: colors.pending }}>
                {changes.length}
              </Num>
              <T variant="small" style={{ color: colors.pending }}>
                {t.attendance.unsavedChanges}
              </T>
            </Row>
          ) : null}
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
  // A thin amber edge on the reading-start side marks a row that changed since the last save.
  unsaved: { borderStartWidth: 4, borderStartColor: colors.pending },
  datePlate: {
    backgroundColor: colors.site,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.siteInk,
    minWidth: 52,
    alignItems: 'center',
  },
  footer: {
    gap: space.xs,
    padding: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
