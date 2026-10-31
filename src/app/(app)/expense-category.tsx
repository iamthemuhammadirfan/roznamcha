import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useExpenseCategories, useProjectAssignments, useProjectEntries, useProjectExpenses } from '@/db/hooks';
import { reverseExpense } from '@/db/mutations';
import type { LedgerEntry, ProjectExpense } from '@/db/schema';
import { reversedIds } from '@/lib/balance';
import { formatDay, today, weekday } from '@/lib/dates';
import { CASH_KINDS, cancelledIds, inRange, labourCash, labourPayments, liveExpenses } from '@/lib/expenses';
import { useActiveProject } from '@/state/active-project';
import { useMember, useWriteContext } from '@/state/session';
import { entryKindLabel, expenseCategoryLabel, lang, t } from '@/i18n';
import { Attribution, useAttribution } from '@/ui/attribution';
import { Card, Empty, Row } from '@/ui/controls';
import { HeaderTitle } from '@/ui/header';
import { type Period, PeriodChips, periodFromParams, periodRange } from '@/ui/period-filter';
import { rangeLabel } from '@/ui/range-picker';
import { Money, Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

/** The category param for cash handed to workers; anything else is an expense_category id. */
const LABOUR = 'labour';

/** One entry: a site expense, or cash handed to a worker. */
type Item =
  | { type: 'site'; id: string; date: string; at: string; e: ProjectExpense }
  | { type: 'labour'; id: string; date: string; at: string; e: LedgerEntry; workerId: string; worker: string };

/** A row of the list: a day's heading with its total, or one entry. */
type Line = { type: 'day'; key: string; day: string; total: number } | { type: 'item'; key: string; it: Item };

/**
 * Every entry behind one line of the expenses summary — one site category (diesel,
 * chai…) or the cash handed to workers — for the period picked there. Grouped by day,
 * newest first, each with its day total; the owner also sees who entered each one.
 * Site expenses are cancelled from here (press and hold, owner only); a worker payment
 * opens that worker's ledger.
 */
export default function ExpenseCategory() {
  const params = useLocalSearchParams<{ category: string; preset?: string; from?: string; to?: string }>();
  const category = params.category ?? LABOUR;
  const isLabour = category === LABOUR;
  // Opens on the period picked on the summary; changed here, it stays here.
  const [period, setPeriod] = useState<Period>(() => periodFromParams(params, { preset: 'all' }));
  const range = periodRange(period, today());

  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const rows = useProjectExpenses(pid);
  const ledger = useProjectEntries(pid);
  const assignments = useProjectAssignments(pid);
  const categories = useExpenseCategories();
  const { role } = useMember();
  const ctx = useWriteContext();
  const attribute = useAttribution();

  const title = isLabour
    ? t.expense.labour
    : expenseCategoryLabel(categories.find((c) => c.id === category)?.name);
  const workerOf = new Map(assignments.map((a) => [a.id, { id: a.worker_id, name: a.worker_name }]));
  const cancelledSite = cancelledIds(rows);
  const reversedLedger = reversedIds(ledger);
  const canCancel = role === 'owner';

  const items: Item[] = [];
  let total = 0;
  if (isLabour) {
    const live = new Set(labourPayments(ledger).map((e) => e.id));
    for (const e of ledger) {
      if (!CASH_KINDS.includes(e.kind) || !inRange(e.date, range)) continue;
      const w = workerOf.get(e.assignment_id);
      items.push({ type: 'labour', id: e.id, date: e.date, at: e.created_at ?? '', e, workerId: w?.id ?? '', worker: w?.name ?? '' });
      if (live.has(e.id)) total += labourCash(e);
    }
  } else {
    const live = new Set(liveExpenses(rows).map((e) => e.id));
    for (const e of rows) {
      if (e.category_id !== category || !inRange(e.date, range)) continue;
      items.push({ type: 'site', id: e.id, date: e.date, at: e.created_at ?? '', e });
      if (live.has(e.id)) total += e.amount_paisa;
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
    if (it.type === 'site') {
      if (!cancelledSite.has(it.id) && it.e.kind === 'expense') group.total += it.e.amount_paisa;
    } else if (!reversedLedger.has(it.id)) {
      group.total += labourCash(it.e);
    }
  }
  // One flat list (day headings and entries) so only what's on screen is drawn: a
  // category can hold years of entries.
  const list: Line[] = days.flatMap((d) => [{ type: 'day' as const, key: `d${d.day}`, day: d.day, total: d.total }, ...d.items.map((it) => ({ type: 'item' as const, key: it.id, it }))]);
  const entryCount = items.filter((it) => (it.type === 'site' ? it.e.kind === 'expense' : true)).length;

  function confirmCancel(e: ProjectExpense) {
    Alert.alert(t.expense.cancel, t.expense.cancelConfirm, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.action.confirm, style: 'destructive', onPress: () => reverseExpense(ctx, e) },
    ]);
  }

  const allTime = period.preset === 'all';

  function renderLine({ item: line }: { item: Line }) {
    if (line.type === 'day') {
      return (
        <Row style={styles.dayHeader}>
          <T variant="bodyBold">{weekday(line.day, lang)}</T>
          <T variant="small" style={{ flex: 1 }}>
            {formatDay(line.day, lang)}
          </T>
          {/* Money never shows a minus sign: a day where more came back than went out is green. */}
          <Money paisa={line.total} size={15} color={line.total < 0 ? colors.owed : colors.muted} />
        </Row>
      );
    }
    const it = line.it;
    if (it.type === 'labour') {
      const reversed = reversedLedger.has(it.id);
      return (
        <Pressable
          onPress={() => it.workerId && router.push({ pathname: '/worker/[id]', params: { id: it.workerId, projectId: pid } })}
          style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.brandSoft }]}>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <T variant="bodyBold" style={reversed ? styles.struck : undefined}>
                {it.worker}
              </T>
              <T variant="small" style={reversed ? { color: colors.pending } : undefined}>
                {reversed ? t.expense.cancelled : entryKindLabel(it.e.kind)}
              </T>
            </View>
            <Money
              paisa={it.e.amount_paisa}
              color={reversed ? colors.muted : it.e.kind === 'repayment' ? colors.owed : colors.text}
            />
          </View>
          <Attribution info={attribute?.(it.e)} />
        </Pressable>
      );
    }
    return (
      <SiteRow
        e={it.e}
        cancelled={cancelledSite.has(it.id)}
        onLongPress={canCancel ? () => confirmCancel(it.e) : undefined}>
        <Attribution info={attribute?.(it.e)} />
      </SiteRow>
    );
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <Stack.Screen options={{ headerTitle: () => <HeaderTitle title={title || t.expense.title} /> }} />
      {/* Fixed: the period. Everything under it scrolls. */}
      <View style={styles.top}>
        <PeriodChips value={period} onChange={setPeriod} />
      </View>
      <FlatList
        data={list}
        keyExtractor={(l) => l.key}
        renderItem={renderLine}
        contentContainerStyle={styles.body}
        initialNumToRender={20}
        windowSize={7}
        ListHeaderComponent={
          <View style={{ gap: space.md }}>
            <Card>
              <Row style={{ gap: space.sm }}>
                <MaterialCommunityIcons
                  name={isLabour ? 'hand-coin-outline' : 'receipt-text-outline'}
                  size={22}
                  color={isLabour ? colors.siteInk : colors.brand}
                />
                <T variant="small" style={{ flex: 1 }}>
                  {allTime ? t.expense.filterAll : rangeLabel(range)}
                </T>
                <Num style={styles.count}>{entryCount}</Num>
                <T variant="small">{t.expense.entries}</T>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <T variant="h2" style={{ flex: 1 }}>
                  {title}
                </T>
                <Money paisa={total} size={24} color={total < 0 ? colors.owed : colors.brand} />
              </Row>
            </Card>
            {items.length > 0 ? (
              <T variant="small">{isLabour ? t.expense.labourTapHint : canCancel ? t.expense.cancelHint : ''}</T>
            ) : null}
          </View>
        }
        ListEmptyComponent={<Empty text={t.expense.noneInRange} />}
      />
    </SafeAreaView>
  );
}

function SiteRow({
  e,
  cancelled,
  onLongPress,
  children,
}: {
  e: ProjectExpense;
  cancelled: boolean;
  onLongPress?: () => void;
  children?: ReactNode;
}) {
  const isCorrection = e.kind === 'correction';
  // The category is the screen's title, so each line leads with what it was for.
  const headline = isCorrection ? t.expense.correction : e.note || t.expense.noNote;
  return (
    <Pressable
      onLongPress={onLongPress && !cancelled && !isCorrection ? onLongPress : undefined}
      style={({ pressed }) => [styles.item, pressed && { backgroundColor: colors.brandSoft }]}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <T
            variant="bodyBold"
            style={[
              cancelled && styles.struck,
              isCorrection && { color: colors.pending },
              !isCorrection && !e.note && { color: colors.muted },
            ]}>
            {headline}
          </T>
          {cancelled ? (
            <T variant="small" style={{ color: colors.pending }}>
              {t.expense.cancelled}
            </T>
          ) : null}
        </View>
        <Money paisa={e.amount_paisa} color={isCorrection || cancelled ? colors.muted : colors.text} />
      </View>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  body: { padding: space.lg, paddingBottom: space.xl, gap: space.sm, flexGrow: 1 },
  count: { fontSize: 15, lineHeight: 22, color: colors.text },
  dayHeader: {
    marginTop: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    paddingBottom: space.xs,
    paddingHorizontal: space.xs,
  },
  item: {
    padding: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  struck: { textDecorationLine: 'line-through', color: colors.muted },
});
