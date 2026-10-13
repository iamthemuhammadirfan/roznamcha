import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useExpenseCategories, useProjectExpenses } from '@/db/hooks';
import { reverseExpense } from '@/db/mutations';
import type { ProjectExpense } from '@/db/schema';
import { formatDay, presetRange, type RangePreset, today, weekday } from '@/lib/dates';
import { cancelledIds, type DayRange, inRange, liveExpenses, summarizeRange } from '@/lib/expenses';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { expenseCategoryLabel, lang, t } from '@/i18n';
import { Chip } from '@/ui/chip';
import { Button, Card, Empty, Row, Screen } from '@/ui/controls';
import { RangePicker, rangeLabel } from '@/ui/range-picker';
import { Money, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

const PRESETS: { value: RangePreset; label: string }[] = [
  { value: 'today', label: t.expense.filterToday },
  { value: 'week', label: t.expense.filterWeek },
  { value: 'month', label: t.expense.filterMonth },
  { value: 'lastMonth', label: t.expense.filterLastMonth },
  { value: 'all', label: t.expense.filterAll },
];

/**
 * The active project's site expenses for a period: this month by default, a quick
 * preset, or any from–to range. The list reads like a daybook — grouped by day, newest
 * first, with each day's total.
 */
export default function ProjectExpenses() {
  const { projectId } = useActiveProject();
  const rows = useProjectExpenses(projectId ?? '');
  const categories = useExpenseCategories();
  const { role } = useMember();
  const ctx = useWriteContext();

  const now = today();
  const [preset, setPreset] = useState<RangePreset | 'custom'>('month');
  const [custom, setCustom] = useState<DayRange | null>(null);
  const [picking, setPicking] = useState(false);
  const range = preset === 'custom' && custom ? custom : presetRange(preset === 'custom' ? 'month' : preset, now);

  const names = new Map(categories.map((c) => [c.id, expenseCategoryLabel(c.name)]));
  const summary = summarizeRange(rows, range);
  const cancelled = cancelledIds(rows);
  const canCancel = role === 'owner';

  const shown = rows.filter((e) => inRange(e.date, range));
  const days: { day: string; items: ProjectExpense[]; total: number }[] = [];
  const live = new Set(liveExpenses(rows).map((e) => e.id));
  for (const e of shown) {
    let group = days[days.length - 1];
    if (!group || group.day !== e.date) {
      group = { day: e.date, items: [], total: 0 };
      days.push(group);
    }
    group.items.push(e);
    if (live.has(e.id)) group.total += e.amount_paisa;
  }
  const maxCategory = Math.max(1, ...summary.byCategory.values());

  function confirmCancel(e: ProjectExpense) {
    Alert.alert(t.expense.cancel, t.expense.cancelConfirm, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.action.confirm, style: 'destructive', onPress: () => reverseExpense(ctx, e) },
    ]);
  }

  return (
    <Screen
      footer={<Button icon="receipt-text-plus-outline" label={t.expense.add} onPress={() => router.push('/expense')} />}>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        // The page's scroll view grows its children; a chip row must stay one row tall.
        style={{ flexGrow: 0 }}
        contentContainerStyle={styles.chips}>
        {PRESETS.map((p) => (
          <Chip key={p.value} label={p.label} selected={preset === p.value} onPress={() => setPreset(p.value)} />
        ))}
        <Chip
          icon="calendar-range"
          label={t.expense.chooseDates}
          selected={preset === 'custom'}
          onPress={() => setPicking(true)}
        />
      </ScrollView>

      <Card>
        <T variant="small">{preset === 'all' ? t.expense.filterAll : rangeLabel(range)}</T>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="bodyBold" style={{ flex: 1 }}>
            {t.expense.rangeTotal}
          </T>
          <Money paisa={summary.total} size={24} color={colors.brand} />
        </Row>
        {[...summary.byCategory.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([id, paisa]) => (
            <View key={id} style={{ gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="small" style={{ flex: 1 }}>
                  {names.get(id) ?? ''}
                </T>
                <Money paisa={paisa} size={15} />
              </Row>
              {/* Share of the period's spending, so the biggest cost stands out at a glance. */}
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(paisa / maxCategory) * 100}%` }]} />
              </View>
            </View>
          ))}
      </Card>

      {shown.length === 0 ? <Empty text={rows.length === 0 ? t.expense.empty : t.expense.noneInRange} /> : null}
      {canCancel && shown.length > 0 ? <T variant="small">{t.expense.cancelHint}</T> : null}

      {days.map((d) => (
        <View key={d.day} style={{ gap: space.sm }}>
          <Row style={styles.dayHeader}>
            <T variant="bodyBold">{weekday(d.day, lang)}</T>
            <T variant="small" style={{ flex: 1 }}>
              {formatDay(d.day, lang)}
            </T>
            <Money paisa={d.total} size={15} color={colors.muted} />
          </Row>
          {d.items.map((e) => {
            const isCorrection = e.kind === 'correction';
            const isCancelled = cancelled.has(e.id);
            return (
              <Pressable
                key={e.id}
                onLongPress={canCancel && !isCancelled && !isCorrection ? () => confirmCancel(e) : undefined}
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.brandSoft }]}>
                <View style={{ flex: 1 }}>
                  <T
                    variant="bodyBold"
                    style={[isCancelled && styles.struck, isCorrection && { color: colors.pending }]}>
                    {isCorrection ? t.expense.correction : (names.get(e.category_id) ?? '')}
                  </T>
                  {isCorrection ? (
                    <T variant="small">{names.get(e.category_id) ?? ''}</T>
                  ) : e.note ? (
                    <T variant="small">{e.note}</T>
                  ) : null}
                  {isCancelled ? (
                    <T variant="small" style={{ color: colors.pending }}>
                      {t.expense.cancelled}
                    </T>
                  ) : null}
                </View>
                <Money paisa={e.amount_paisa} color={isCorrection || isCancelled ? colors.muted : colors.text} />
              </Pressable>
            );
          })}
        </View>
      ))}

      <RangePicker
        visible={picking}
        initial={custom}
        onClose={() => setPicking(false)}
        onPick={(r) => {
          setCustom(r);
          setPreset('custom');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { gap: space.sm, paddingVertical: space.xs, alignItems: 'center' },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.brandSoft, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: colors.brand },
  dayHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: space.xs,
    paddingHorizontal: space.xs,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
});
