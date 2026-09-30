import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useProjectAssignments, useProjectAttendance } from '@/db/hooks';
import { activeOn, coverage, type Coverage, monthWeeks, summarize } from '@/lib/attendance';
import { attendanceEarning } from '@/lib/balance';
import { formatMonth, today, weekdaysShort } from '@/lib/dates';
import { useActiveProject } from '@/state/active-project';
import { lang, t } from '@/i18n';
import { StatusCount } from '@/ui/attendance';
import { Card, Row, Screen } from '@/ui/controls';
import { Money, Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

const TINT: Record<Coverage, string> = {
  none: 'transparent',
  complete: colors.owedSoft,
  partial: colors.pendingSoft,
  missing: colors.recoverSoft,
};

/**
 * Month view of one project's haazri. The owner's question is "was attendance marked
 * every day last week?" — gaps show up as red days instead of silently not existing.
 */
export default function AttendanceCalendar() {
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const assignments = useProjectAssignments(pid);
  const rows = useProjectAttendance(pid);

  const now = today();
  const [ym, setYm] = useState({ y: Number(now.slice(0, 4)), m: Number(now.slice(5, 7)) });
  const prefix = `${ym.y}-${String(ym.m).padStart(2, '0')}`;
  const isCurrentMonth = now.startsWith(prefix);

  const markedByDay = new Map<string, Set<string>>();
  for (const r of rows) {
    if (!r.date.startsWith(prefix)) continue;
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

  function shift(delta: number) {
    const d = new Date(ym.y, ym.m - 1 + delta, 1);
    setYm({ y: d.getFullYear(), m: d.getMonth() + 1 });
  }

  function open(day: string) {
    if (day > now) return Alert.alert(t.attendance.futureDay);
    router.push({ pathname: '/attendance-day', params: { date: day } });
  }

  return (
    <Screen>
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => shift(-1)} style={styles.nav} accessibilityRole="button">
          <T variant="bodyBold" style={{ color: colors.brand }}>
            {t.attendance.prevMonth}
          </T>
        </Pressable>
        <T variant="h2">{formatMonth(ym.y, ym.m, lang)}</T>
        <Pressable
          onPress={() => shift(1)}
          disabled={isCurrentMonth}
          style={[styles.nav, isCurrentMonth && { opacity: 0.3 }]}
          accessibilityRole="button">
          <T variant="bodyBold" style={{ color: colors.brand }}>
            {t.attendance.nextMonth}
          </T>
        </Pressable>
      </Row>

      <Card style={{ padding: space.sm, gap: space.xs }}>
        <View style={styles.week}>
          {weekdaysShort(lang).map((w) => (
            <T key={w} variant="small" numberOfLines={1} adjustsFontSizeToFit style={styles.weekday}>
              {w}
            </T>
          ))}
        </View>
        {monthWeeks(ym.y, ym.m).map((week, i) => (
          <View key={i} style={styles.week}>
            {week.map((day, j) => {
              if (!day) return <View key={j} style={styles.cell} />;
              const c = dayCoverage(day);
              return (
                <Pressable
                  key={day}
                  onPress={() => open(day)}
                  style={({ pressed }) => [
                    styles.cell,
                    styles.day,
                    { backgroundColor: TINT[c] },
                    day === now && styles.today,
                    day > now && { opacity: 0.35 },
                    pressed && { opacity: 0.6 },
                  ]}>
                  <Num bold={day === now} style={{ fontSize: 18 }}>
                    {Number(day.slice(8))}
                  </Num>
                </Pressable>
              );
            })}
          </View>
        ))}
      </Card>

      <Row style={{ flexWrap: 'wrap', gap: space.md }}>
        <Legend color={colors.owedSoft} label={t.attendance.complete} />
        <Legend color={colors.pendingSoft} label={t.attendance.partial} />
        <Legend color={colors.recoverSoft} label={t.attendance.missing} />
      </Row>

      <Card>
        <Row style={{ flexWrap: 'wrap', gap: space.md }}>
          <StatusCount status="full" n={month.full} />
          <StatusCount status="half" n={month.half} />
          <StatusCount status="absent" n={month.absent} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small">{t.ledger.earned}</T>
          <Money paisa={monthWages} size={20} />
        </Row>
      </Card>
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <T variant="small">{label}</T>
    </Row>
  );
}

const styles = StyleSheet.create({
  nav: { minHeight: 48, justifyContent: 'center', paddingHorizontal: space.sm },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, lineHeight: 28 },
  cell: { flex: 1, aspectRatio: 1, margin: 2 },
  day: { borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  today: { borderWidth: 2, borderColor: colors.brand },
  swatch: { width: 18, height: 18, borderRadius: 4, borderWidth: 1, borderColor: colors.border },
});
