import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type AssignmentWithWorker, type DayMark, useMarksOn, useProjectAssignments, useProjectAttendance } from '@/db/hooks';
import { AttendanceClashError, saveAttendance } from '@/db/mutations';
import type { Attendance } from '@/db/schema';
import { activeOn, clashingMarks, type DayStatus, dayShare, summarize } from '@/lib/attendance';
import { attendanceEarning } from '@/lib/balance';
import { daysBetween, formatDay, today, weekday } from '@/lib/dates';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { lang, t } from '@/i18n';
import { StatusCount, StatusPicker } from '@/ui/attendance';
import { Attribution, useAttribution } from '@/ui/attribution';
import { Banner, Button, Card, Empty, Row } from '@/ui/controls';
import { Money, Num, T } from '@/ui/text';
import { colors, space, TOUCH_MIN } from '@/ui/theme';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Overtime is a full day plus hours; the marking screen shows it as full. */
function asDayStatus(s: string): DayStatus {
  return s === 'half' || s === 'absent' ? s : 'full';
}

/**
 * One day's haazri for the active project. Nobody is pre-marked: the munshi taps full,
 * half or absent for each worker, so a save never records a day nobody looked at. Only
 * marked rows are saved; the rest stay unmarked and the day shows as partly done.
 */
export default function AttendanceDay() {
  const params = useLocalSearchParams<{ date?: string }>();
  const date = params.date && DAY.test(params.date) ? params.date : today();
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const { role } = useMember();
  const ctx = useWriteContext();
  const attribute = useAttribution();

  const assignments = useProjectAssignments(pid);
  const marksOnDay = useMarksOn(date);
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

  /** null until the munshi picks one (or one was saved earlier). */
  function statusOf(a: AssignmentWithWorker): DayStatus | null {
    const saved = existing.get(a.id);
    return draft[a.id] ?? (saved ? asDayStatus(saved.status) : null);
  }

  function rateOf(a: AssignmentWithWorker) {
    return existing.get(a.id)?.rate_applied_paisa ?? a.daily_rate_paisa;
  }

  function isLocked(a: AssignmentWithWorker) {
    return lockedOld && existing.has(a.id);
  }

  // Marked rows whose status differs from what's saved (or that have nothing saved).
  const changes = people.filter((a) => {
    if (isLocked(a) || !(a.id in draft)) return false;
    const saved = existing.get(a.id);
    return !saved || asDayStatus(saved.status) !== draft[a.id];
  });

  const marked = people.flatMap((a) => {
    const status = statusOf(a);
    return status ? [{ status, rate_applied_paisa: rateOf(a), overtime_hours: 0 }] : [];
  });
  const summary = summarize(marked);
  const unmarked = people.length - marked.length;
  const wages = marked.reduce((s, m) => s + attendanceEarning(m), 0);

  /** This worker's marks on other projects the same day. */
  function elsewhere(a: AssignmentWithWorker): DayMark[] {
    return marksOnDay.filter((m) => m.worker_id === a.worker_id && m.assignment_id !== a.id);
  }

  function set(a: AssignmentWithWorker, status: DayStatus) {
    if (isLocked(a)) return Alert.alert(t.attendance.lockedOld);
    const clash = clashingMarks(status, elsewhere(a));
    if (clash.length > 0) {
      const where = clash.map((m) => `${m.project_code} ${m.project_name}`).join('\n');
      return Alert.alert(t.attendance.clashTitle, `${a.worker_name}\n${where}\n\n${t.attendance.clashBody}`);
    }
    setDraft((d) => {
      // Tapping a fresh pick again clears it, so a wrong tap can be undone before saving.
      if (d[a.id] === status && !existing.has(a.id)) {
        const { [a.id]: _cleared, ...rest } = d;
        return rest;
      }
      return { ...d, [a.id]: status };
    });
  }

  async function commit() {
    setBusy(true);
    try {
      await saveAttendance(
        ctx,
        date,
        changes.map((a) => ({ assignmentId: a.id, status: draft[a.id] })),
      );
      router.back();
    } catch (e) {
      setBusy(false);
      if (e instanceof AttendanceClashError) {
        const who = people.find((p) => p.id === e.assignmentId)?.worker_name ?? '';
        Alert.alert(t.attendance.clashTitle, `${who}\n\n${t.attendance.clashBody}`);
      } else Alert.alert(t.common.error, String(e));
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
        {unmarked > 0 ? <UnmarkedCount n={unmarked} /> : null}
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
          const edited = changes.includes(a);
          const saved = existing.get(a.id);
          return (
            <View style={[styles.item, edited && styles.unsaved, isLocked(a) && { opacity: 0.6 }]}>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <T variant="h2" style={{ fontSize: 20 }}>
                    {a.worker_name}
                  </T>
                  {a.worker_father_name ? (
                    <T variant="small">
                      {t.worker.son} {a.worker_father_name}
                    </T>
                  ) : null}
                  {status ? (
                    <Money
                      paisa={attendanceEarning({ status, rate_applied_paisa: rateOf(a), overtime_hours: 0 })}
                      size={14}
                      color={colors.muted}
                    />
                  ) : (
                    <T variant="small" style={{ color: colors.pending }}>
                      {t.attendance.notMarked}
                    </T>
                  )}
                  {elsewhere(a)
                    .filter((m) => dayShare(m.status) > 0)
                    .map((m) => (
                      <Row key={m.assignment_id} style={styles.elsewhere}>
                        <T variant="small" style={{ color: colors.pending }}>
                          {t.attendance.elsewhere}
                        </T>
                        <Num bold style={styles.elsewhereCode}>
                          {m.project_code}
                        </Num>
                        <T variant="small" style={{ color: colors.pending }}>
                          {m.status === 'half' ? t.attendance.half : t.attendance.full}
                        </T>
                      </Row>
                    ))}
                </View>
                <StatusPicker value={status} onChange={(s) => set(a, s)} disabled={isLocked(a)} />
              </View>
              {/* Who first marked this day; changing the mark later doesn't change who marked it. */}
              {saved && attribute ? <Attribution info={attribute(saved)} /> : null}
            </View>
          );
        }}
      />
      {people.length > 0 ? (
        <View style={styles.footer}>
          {unmarked > 0 ? (
            <Row style={{ justifyContent: 'center' }}>
              <UnmarkedCount n={unmarked} />
            </Row>
          ) : null}
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
            // "Saved" only once everyone is marked and nothing is pending.
            label={changes.length === 0 && unmarked === 0 ? t.attendance.saved : t.attendance.save}
            onPress={save}
            busy={busy}
            disabled={changes.length === 0}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}

/** "3 ابھی نہیں لگی": workers with no mark yet for the day. */
function UnmarkedCount({ n }: { n: number }) {
  return (
    <Row>
      <Num bold style={{ fontSize: 20, color: colors.pending }}>
        {n}
      </Num>
      <T variant="small" style={{ color: colors.pending }}>
        {t.attendance.notMarked}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, flexGrow: 1 },
  item: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  row: {
    minHeight: TOUCH_MIN - space.sm * 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
  elsewhere: { gap: space.xs, flexWrap: 'wrap' },
  elsewhereCode: { fontSize: 14, lineHeight: 22, color: colors.siteInk },
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
