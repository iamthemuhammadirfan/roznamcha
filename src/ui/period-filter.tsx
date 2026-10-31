// The period filter shared by the expense screens: quick presets (today, this week, this
// month, last month, all) plus "choose dates", which opens the calendar for any from–to
// range. One component so the summary and its detail screens always behave the same.
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { type Day, presetRange, type RangePreset } from '@/lib/dates';
import type { DayRange } from '@/lib/expenses';
import { t } from '@/i18n';

import { Chip } from './chip';
import { RangePicker } from './range-picker';
import { space } from './theme';

export type Period = { preset: RangePreset } | { preset: 'custom'; range: DayRange };

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: t.expense.filterToday },
  { value: 'week', label: t.expense.filterWeek },
  { value: 'month', label: t.expense.filterMonth },
  { value: 'lastMonth', label: t.expense.filterLastMonth },
  { value: 'all', label: t.expense.filterAll },
];

const PRESET_VALUES = PRESETS.map((p) => p.value as string);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** The days a period covers, counted from `now`. */
export function periodRange(p: Period, now: Day): DayRange {
  return p.preset === 'custom' ? p.range : presetRange(p.preset, now);
}

/** Route params for a period, so a detail screen opens on the same one. */
export function periodParams(p: Period, now: Day): { preset: string; from: string; to: string } {
  const r = periodRange(p, now);
  return { preset: p.preset, from: r.from, to: r.to };
}

/** The period in route params, or `fallback` if they don't name one. */
export function periodFromParams(params: { preset?: string; from?: string; to?: string }, fallback: Period): Period {
  if (params.preset && PRESET_VALUES.includes(params.preset)) return { preset: params.preset as RangePreset };
  if (params.preset === 'custom' && params.from && params.to && DAY.test(params.from) && DAY.test(params.to)) {
    return { preset: 'custom', range: { from: params.from, to: params.to } };
  }
  return fallback;
}

/** A horizontal row of period chips; "choose dates" opens the calendar. */
export function PeriodChips({ value, onChange }: { value: Period; onChange: (p: Period) => void }) {
  const [picking, setPicking] = useState(false);
  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={styles.chips}>
        {PRESETS.map((p) => (
          <Chip key={p.value} label={p.label} selected={value.preset === p.value} onPress={() => onChange({ preset: p.value })} />
        ))}
        <Chip
          icon="calendar-range"
          label={t.expense.chooseDates}
          selected={value.preset === 'custom'}
          onPress={() => setPicking(true)}
        />
      </ScrollView>
      <RangePicker
        visible={picking}
        initial={value.preset === 'custom' ? value.range : null}
        onClose={() => setPicking(false)}
        onPick={(range) => onChange({ preset: 'custom', range })}
      />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, alignItems: 'center' },
});
