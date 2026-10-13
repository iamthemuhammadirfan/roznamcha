// A Monday-first month of day cells, shared by the attendance calendar and the date
// range picker. The caller draws each day; this only does weeks, weekday names and the
// month switcher.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { monthWeeks } from '@/lib/attendance';
import { formatMonth, weekdaysShort } from '@/lib/dates';
import { isUrdu, lang, t } from '@/i18n';

import { Row } from './controls';
import { T } from './text';
import { colors, space } from './theme';

export interface YearMonth {
  y: number;
  m: number;
}

export function shiftMonth(ym: YearMonth, delta: number): YearMonth {
  const d = new Date(ym.y, ym.m - 1 + delta, 1);
  return { y: d.getFullYear(), m: d.getMonth() + 1 };
}

export function monthOf(day: string): YearMonth {
  return { y: Number(day.slice(0, 4)), m: Number(day.slice(5, 7)) };
}

/** Month title between back/forward arrows. Arrows follow reading direction. */
export function MonthNav({
  value,
  onChange,
  canGoForward = true,
}: {
  value: YearMonth;
  onChange: (next: YearMonth) => void;
  canGoForward?: boolean;
}) {
  // In RTL the previous month sits on the right, so its arrow points right.
  const back = isUrdu ? 'chevron-right' : 'chevron-left';
  const fwd = isUrdu ? 'chevron-left' : 'chevron-right';
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.attendance.prevMonth}
        onPress={() => onChange(shiftMonth(value, -1))}
        style={styles.arrow}>
        <MaterialCommunityIcons name={back} size={30} color={colors.brand} />
      </Pressable>
      <T variant="h2" style={{ flex: 1, textAlign: 'center' }}>
        {formatMonth(value.y, value.m, lang)}
      </T>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t.attendance.nextMonth}
        disabled={!canGoForward}
        onPress={() => onChange(shiftMonth(value, 1))}
        style={[styles.arrow, !canGoForward && { opacity: 0.25 }]}>
        <MaterialCommunityIcons name={fwd} size={30} color={colors.brand} />
      </Pressable>
    </Row>
  );
}

export function MonthGrid({ value, renderDay }: { value: YearMonth; renderDay: (day: string) => ReactNode }) {
  return (
    <View style={{ gap: space.xs }}>
      <View style={styles.week}>
        {weekdaysShort(lang).map((w) => (
          <T key={w} variant="small" numberOfLines={1} adjustsFontSizeToFit style={styles.weekday}>
            {w}
          </T>
        ))}
      </View>
      {monthWeeks(value.y, value.m).map((week, i) => (
        <View key={i} style={styles.week}>
          {week.map((day, j) => (
            <View key={day ?? `pad-${j}`} style={styles.cell}>
              {day ? renderDay(day) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  arrow: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  week: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 13, lineHeight: 28 },
  cell: { flex: 1, aspectRatio: 1, padding: 2 },
});
