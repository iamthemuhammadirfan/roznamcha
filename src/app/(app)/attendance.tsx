import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useProjectAssignments, useProjectAttendance } from '@/db/hooks';
import { activeOn, coverage, type Coverage, summarize } from '@/lib/attendance';
import { attendanceEarning } from '@/lib/balance';
import { today } from '@/lib/dates';
import { useActiveProject } from '@/state/active-project';
import { t } from '@/i18n';
import { StatusCount } from '@/ui/attendance';
import { Card, Row, Screen } from '@/ui/controls';
import { MonthGrid, MonthNav, monthOf } from '@/ui/month-grid';
import { Money, Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

// A bar under the date rather than a filled cell: a month of unmarked days reads as
// "to do", not as a wall of red.
const BAR: Record<Coverage, string> = {
  none: 'transparent',
  complete: colors.owed,
  partial: colors.pending,
  missing: colors.recover,
};

/**
 * Month view of one project's haazri. The owner's question is "was attendance marked
 * every day last week?" — gaps show up as red marks instead of silently not existing.
 * Today's sheet is one tap away at the top, because that's what the munshi opens daily.
 */
export default function AttendanceCalendar() {
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const assignments = useProjectAssignments(pid);
  const rows = useProjectAttendance(pid);

  const now = today();
  const [ym, setYm] = useState(monthOf(now));
  const prefix = `${ym.y}-${String(ym.m).padStart(2, '0')}`;

  const markedByDay = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = markedByDay.get(r.date) ?? new Set<string>();
    set.add(r.assignment_id);
    markedByDay.set(r.date, set);
  }

  function dayCoverage(day: string): Coverage {
    if (day > now) return 'none';
    const expected = assignments.filter((a) => activeOn(a, day));
    const marked = markedByDay.get(day);
    const hits = marked ? expected.filter((a) => marked.has(a.id)).length : 0;
    return coverage(expected.length, hits);
  }

  const monthRows = rows.filter((r) => r.date.startsWith(prefix));
  const month = summarize(monthRows);
  const monthWages = monthRows.reduce((s, r) => s + attendanceEarning(r), 0);
  const todayState = dayCoverage(now);

  function open(day: string) {
    if (day > now) return Alert.alert(t.attendance.futureDay);
    router.push({ pathname: '/attendance-day', params: { date: day } });
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => open(now)}
        style={({ pressed }) => [styles.today, pressed && { opacity: 0.85 }]}>
        <MaterialCommunityIcons name="calendar-check" size={36} color={colors.white} />
        <View style={{ flex: 1 }}>
          <T variant="h2" style={{ color: colors.white }}>
            {t.attendance.markToday}
          </T>
          {todayState !== 'none' ? (
            <T variant="small" style={{ color: colors.brandSoft }}>
              {t.attendance[todayState]}
            </T>
          ) : null}
        </View>
      </Pressable>

      <Card style={{ padding: space.md, gap: space.sm }}>
        <MonthNav value={ym} onChange={setYm} canGoForward={!now.startsWith(prefix)} />
        <MonthGrid
          value={ym}
          renderDay={(day) => {
            const c = dayCoverage(day);
            const isToday = day === now;
            return (
              <Pressable
                onPress={() => open(day)}
                style={({ pressed }) => [
                  styles.day,
                  isToday && styles.dayToday,
                  day > now && { opacity: 0.3 },
                  pressed && { backgroundColor: colors.brandSoft },
                ]}>
                <Num bold={isToday} style={{ fontSize: 18, color: isToday ? colors.siteInk : colors.text }}>
                  {Number(day.slice(8))}
                </Num>
                <View style={[styles.bar, { backgroundColor: BAR[c] }]} />
              </Pressable>
            );
          }}
        />
        <Row style={{ gap: space.sm }}>
          <Legend color={colors.owed} label={t.attendance.complete} />
          <Legend color={colors.pending} label={t.attendance.partial} />
          <Legend color={colors.recover} label={t.attendance.missing} />
        </Row>
      </Card>

      <Card>
        <Row style={{ flexWrap: 'wrap', gap: space.md }}>
          <StatusCount status="full" n={month.full} />
          <StatusCount status="half" n={month.half} />
          <StatusCount status="absent" n={month.absent} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small" style={{ flex: 1 }}>
            {t.ledger.earned}
          </T>
          <Money paisa={monthWages} size={20} />
        </Row>
      </Card>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    // Equal columns with the label filling its column: Android mis-measures shrink-wrapped
    // Nastaliq and drops the last word.
    <Row style={{ flex: 1, gap: space.xs }}>
      <View style={[styles.legendBar, { backgroundColor: color }]} />
      <T variant="small" style={{ flex: 1 }}>
        {label}
      </T>
    </Row>
  );
}

const styles = StyleSheet.create({
  today: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 88,
    borderRadius: 14,
    backgroundColor: colors.brand,
    paddingHorizontal: space.lg,
  },
  day: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 3 },
  // Today wears the same yellow plate as the project number.
  dayToday: { backgroundColor: colors.site, borderWidth: 2, borderColor: colors.siteInk },
  bar: { width: '50%', height: 4, borderRadius: 2 },
  legendBar: { width: 18, height: 4, borderRadius: 2 },
});
