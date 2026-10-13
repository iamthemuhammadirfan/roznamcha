import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useExpenseCategories, useProjectAssignments, useProjectEntries, useProjectExpenses } from '@/db/hooks';
import { reverseExpense } from '@/db/mutations';
import type { ProjectExpense } from '@/db/schema';
import { reversedIds } from '@/lib/balance';
import { formatDay, presetRange, type RangePreset, today, weekday } from '@/lib/dates';
import { cancelledIds, type DayRange, inRange, labourPayments, liveExpenses, projectSpend } from '@/lib/expenses';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { entryKindLabel, expenseCategoryLabel, lang, t } from '@/i18n';
import { Chip } from '@/ui/chip';
import { Card, Empty, Row } from '@/ui/controls';
import { Fab } from '@/ui/fab';
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

type Kind = 'all' | 'labour' | 'site';

/** One line of the daybook: a site expense, or cash handed to a worker. */
type Item =
  | { type: 'site'; id: string; date: string; at: string; e: ProjectExpense }
  | {
      type: 'labour';
      id: string;
      date: string;
      at: string;
      kind: string;
      paisa: number;
      workerId: string;
      worker: string;
    };

/**
 * Everything spent on the active project in a period: cash handed to workers (advances
 * and payments from their ledgers) and site expenses (diesel, chai, material…). Date
 * presets or any from–to range; a second filter splits workers from site. The list reads
 * like a daybook — grouped by day, newest first, with each day's total.
 */
export default function ProjectExpenses() {
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const rows = useProjectExpenses(pid);
  const ledger = useProjectEntries(pid);
  const assignments = useProjectAssignments(pid);
  const categories = useExpenseCategories();
  const { role } = useMember();
  const ctx = useWriteContext();

  const now = today();
  const [preset, setPreset] = useState<RangePreset | 'custom'>('month');
  const [custom, setCustom] = useState<DayRange | null>(null);
  const [picking, setPicking] = useState(false);
  const [kind, setKind] = useState<Kind>('all');
  const range = preset === 'custom' && custom ? custom : presetRange(preset === 'custom' ? 'month' : preset, now);

  const names = new Map(categories.map((c) => [c.id, expenseCategoryLabel(c.name)]));
  const workerOf = new Map(assignments.map((a) => [a.id, { id: a.worker_id, name: a.worker_name }]));
  const spend = projectSpend(rows, ledger, range);
  const cancelledSite = cancelledIds(rows);
  const liveSite = new Set(liveExpenses(rows).map((e) => e.id));
  const reversedLedger = reversedIds(ledger);
  const liveLabour = new Set(labourPayments(ledger).map((e) => e.id));
  const canCancel = role === 'owner';

  const items: Item[] = [];
  if (kind !== 'labour') {
    for (const e of rows) {
      if (inRange(e.date, range)) items.push({ type: 'site', id: e.id, date: e.date, at: e.created_at ?? '', e });
    }
  }
  if (kind !== 'site') {
    for (const e of ledger) {
      if ((e.kind !== 'advance' && e.kind !== 'payment') || !inRange(e.date, range)) continue;
      const w = workerOf.get(e.assignment_id);
      items.push({
        type: 'labour',
        id: e.id,
        date: e.date,
        at: e.created_at ?? '',
        kind: e.kind,
        paisa: e.amount_paisa,
        workerId: w?.id ?? '',
        worker: w?.name ?? '',
      });
    }
  }
  items.sort((a, b) => (a.date === b.date ? b.at.localeCompare(a.at) : b.date.localeCompare(a.date)));

  const days: { day: string; items: Item[]; total: number }[] = [];
  for (const it of items) {
    let group = days[days.length - 1];
    if (!group || group.day !== it.date) {
      group = { day: it.date, items: [], total: 0 };
      days.push(group);
    }
    group.items.push(it);
    if (it.type === 'site' && liveSite.has(it.id)) group.total += it.e.amount_paisa;
    if (it.type === 'labour' && liveLabour.has(it.id)) group.total += it.paisa;
  }

  const shownTotal = kind === 'labour' ? spend.labour : kind === 'site' ? spend.site : spend.total;
  const maxShare = Math.max(1, spend.labour, ...spend.byCategory.values());

  function confirmCancel(e: ProjectExpense) {
    Alert.alert(t.expense.cancel, t.expense.cancelConfirm, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.action.confirm, style: 'destructive', onPress: () => reverseExpense(ctx, e) },
    ]);
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      {/* Fixed: when, and what kind. Only the summary and the daybook scroll. */}
      <View style={styles.top}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
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
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flexGrow: 0 }}
          contentContainerStyle={styles.chips}>
          <Chip label={t.expense.typeAll} selected={kind === 'all'} onPress={() => setKind('all')} />
          <Chip
            icon="hand-coin-outline"
            label={t.expense.labour}
            selected={kind === 'labour'}
            onPress={() => setKind('labour')}
          />
          <Chip
            icon="receipt-text-outline"
            label={t.expense.site}
            selected={kind === 'site'}
            onPress={() => setKind('site')}
          />
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          <T variant="small">{preset === 'all' ? t.expense.filterAll : rangeLabel(range)}</T>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="bodyBold" style={{ flex: 1 }}>
              {kind === 'labour' ? t.expense.labour : kind === 'site' ? t.expense.site : t.expense.spendTotal}
            </T>
            <Money paisa={shownTotal} size={24} color={colors.brand} />
          </Row>
          {/* Where the money went, longest bar first, so the biggest cost stands out. */}
          {kind !== 'site' ? (
            <Share
              icon="hand-coin-outline"
              label={t.expense.labour}
              paisa={spend.labour}
              max={maxShare}
              tint={colors.siteInk}
            />
          ) : null}
          {kind !== 'labour'
            ? [...spend.byCategory.entries()]
                .sort((a, b) => b[1] - a[1])
                .map(([id, paisa]) => (
                  <Share
                    key={id}
                    icon="receipt-text-outline"
                    label={names.get(id) ?? ''}
                    paisa={paisa}
                    max={maxShare}
                    tint={colors.brand}
                  />
                ))
            : null}
        </Card>

        {items.length === 0 ? <Empty text={t.expense.noneInRange} /> : null}
        {items.length > 0 ? (
          <T variant="small">{kind === 'site' ? (canCancel ? t.expense.cancelHint : '') : t.expense.labourTapHint}</T>
        ) : null}

        {days.map((d) => (
          <View key={d.day} style={{ gap: space.sm }}>
            <Row style={styles.dayHeader}>
              <T variant="bodyBold">{weekday(d.day, lang)}</T>
              <T variant="small" style={{ flex: 1 }}>
                {formatDay(d.day, lang)}
              </T>
              <Money paisa={d.total} size={15} color={colors.muted} />
            </Row>
            {d.items.map((it) =>
              it.type === 'labour' ? (
                <Pressable
                  key={it.id}
                  onPress={() => it.workerId && router.push({ pathname: '/worker/[id]', params: { id: it.workerId } })}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.brandSoft }]}>
                  <MaterialCommunityIcons name="hand-coin-outline" size={24} color={colors.siteInk} />
                  <View style={{ flex: 1 }}>
                    <T variant="bodyBold" style={reversedLedger.has(it.id) ? styles.struck : undefined}>
                      {it.worker}
                    </T>
                    <T variant="small" style={reversedLedger.has(it.id) ? { color: colors.pending } : undefined}>
                      {reversedLedger.has(it.id) ? t.expense.cancelled : entryKindLabel(it.kind)}
                    </T>
                  </View>
                  <Money paisa={it.paisa} color={reversedLedger.has(it.id) ? colors.muted : colors.text} />
                </Pressable>
              ) : (
                <SiteRow
                  key={it.id}
                  e={it.e}
                  name={names.get(it.e.category_id) ?? ''}
                  cancelled={cancelledSite.has(it.id)}
                  onLongPress={canCancel ? () => confirmCancel(it.e) : undefined}
                />
              ),
            )}
          </View>
        ))}
      </ScrollView>

      <Fab icon="receipt-text-plus-outline" label={t.expense.add} onPress={() => router.push('/expense')} />

      <RangePicker
        visible={picking}
        initial={custom}
        onClose={() => setPicking(false)}
        onPick={(r) => {
          setCustom(r);
          setPreset('custom');
        }}
      />
    </SafeAreaView>
  );
}

function Share({
  icon,
  label,
  paisa,
  max,
  tint,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  paisa: number;
  max: number;
  tint: string;
}) {
  return (
    <View style={{ gap: 2 }}>
      <Row style={{ gap: space.xs }}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.muted} />
        <T variant="small" style={{ flex: 1 }}>
          {label}
        </T>
        <Money paisa={paisa} size={15} />
      </Row>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(paisa / max) * 100}%`, backgroundColor: tint }]} />
      </View>
    </View>
  );
}

function SiteRow({
  e,
  name,
  cancelled,
  onLongPress,
}: {
  e: ProjectExpense;
  name: string;
  cancelled: boolean;
  onLongPress?: () => void;
}) {
  const isCorrection = e.kind === 'correction';
  return (
    <Pressable
      onLongPress={onLongPress && !cancelled && !isCorrection ? onLongPress : undefined}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.brandSoft }]}>
      <MaterialCommunityIcons name="receipt-text-outline" size={24} color={colors.brand} />
      <View style={{ flex: 1 }}>
        <T variant="bodyBold" style={[cancelled && styles.struck, isCorrection && { color: colors.pending }]}>
          {isCorrection ? t.expense.correction : name}
        </T>
        {isCorrection ? <T variant="small">{name}</T> : e.note ? <T variant="small">{e.note}</T> : null}
        {cancelled ? (
          <T variant="small" style={{ color: colors.pending }}>
            {t.expense.cancelled}
          </T>
        ) : null}
      </View>
      <Money paisa={e.amount_paisa} color={isCorrection || cancelled ? colors.muted : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: { gap: space.sm, alignItems: 'center' },
  // Room under the last row so the floating button never hides it.
  body: { padding: space.lg, paddingBottom: 96, gap: space.md },
  track: { height: 6, borderRadius: 3, backgroundColor: colors.brandSoft, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  dayHeader: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: space.xs,
    paddingHorizontal: space.xs,
  },
  row: {
    flexDirection: 'row',
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
