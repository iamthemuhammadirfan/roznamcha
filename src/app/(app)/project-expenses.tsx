import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useExpenseCategories, useProjectEntries, useProjectExpenses } from '@/db/hooks';
import { presetRange, today } from '@/lib/dates';
import { CASH_KINDS, inRange, projectSpend } from '@/lib/expenses';
import { useActiveProject } from '@/state/active-project';
import { expenseCategoryLabel, isUrdu, t } from '@/i18n';
import { Chip } from '@/ui/chip';
import { Card, Empty, Row } from '@/ui/controls';
import { Fab } from '@/ui/fab';
import { type Period, PeriodChips, periodParams, periodRange } from '@/ui/period-filter';
import { rangeLabel } from '@/ui/range-picker';
import { Money, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

type Kind = 'all' | 'labour' | 'site';

/**
 * Everything spent on the active project in a period: cash handed to workers (advances
 * and payments from their ledgers) and site expenses by category (diesel, chai,
 * material…). Date presets or any from–to range; a second filter splits workers from
 * site. Each line opens its entries for the same period (expense-category).
 */
export default function ProjectExpenses() {
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const rows = useProjectExpenses(pid);
  const ledger = useProjectEntries(pid);
  const categories = useExpenseCategories();

  const now = today();
  // Opens on this month, unless nothing was spent this month yet (the 1st, or a quiet
  // site): then on everything, so the screen never opens empty while the project card
  // shows a total "since start". A period the user picks always wins.
  const [picked, setPicked] = useState<Period | null>(null);
  const month = presetRange('month', now);
  const spentThisMonth =
    rows.some((e) => inRange(e.date, month)) ||
    ledger.some((e) => CASH_KINDS.includes(e.kind) && inRange(e.date, month));
  const period: Period = picked ?? { preset: spentThisMonth ? 'month' : 'all' };
  const [kind, setKind] = useState<Kind>('all');
  const range = periodRange(period, now);

  const names = new Map(categories.map((c) => [c.id, expenseCategoryLabel(c.name)]));
  const open = (category: string) =>
    router.push({ pathname: '/expense-category', params: { category, ...periodParams(period, now) } });
  const spend = projectSpend(rows, ledger, range);

  const shownTotal = kind === 'labour' ? spend.labour : kind === 'site' ? spend.site : spend.total;
  const maxShare = Math.max(1, Math.abs(spend.labour), ...spend.byCategory.values());

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      {/* Fixed: when, and what kind. The summary scrolls under them. */}
      <View style={styles.top}>
        <PeriodChips value={period} onChange={setPicked} />
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
          <T variant="small">{period.preset === 'all' ? t.expense.filterAll : rangeLabel(range)}</T>
          <Row style={{ justifyContent: 'space-between' }}>
            <T variant="bodyBold" style={{ flex: 1 }}>
              {kind === 'labour' ? t.expense.labour : kind === 'site' ? t.expense.site : t.expense.spendTotal}
            </T>
            <Money paisa={shownTotal} size={24} color={colors.brand} />
          </Row>
          {shownTotal > 0 ? <T variant="small">{t.expense.tapCategoryHint}</T> : null}
          {/* Where the money went, longest bar first, so the biggest cost stands out. */}
          {/* Net cash to workers: what went out less what came back (واپسی). Negative
              when more came back in the period than went out, and then says so. */}
          {kind !== 'site' && spend.labour !== 0 ? (
            <Share
              icon={spend.labour > 0 ? 'hand-coin-outline' : 'cash-refund'}
              label={spend.labour > 0 ? t.expense.labour : t.expense.labourReturned}
              paisa={Math.abs(spend.labour)}
              max={maxShare}
              tint={spend.labour > 0 ? colors.siteInk : colors.owed}
              onPress={() => open('labour')}
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
                    onPress={() => open(id)}
                  />
                ))
            : null}
        </Card>

        {shownTotal === 0 ? <Empty text={t.expense.noneInRange} /> : null}
      </ScrollView>

      <Fab icon="receipt-text-plus-outline" label={t.expense.add} onPress={() => router.push('/expense')} />

    </SafeAreaView>
  );
}

/** One line of the summary: what, how much, a bar for its share. Opens its entries. */
function Share({
  icon,
  label,
  paisa,
  max,
  tint,
  onPress,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  paisa: number;
  max: number;
  tint: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.share, pressed && { backgroundColor: colors.brandSoft }]}>
      <Row style={{ gap: space.xs }}>
        <MaterialCommunityIcons name={icon} size={18} color={colors.muted} />
        <T variant="body" style={{ flex: 1 }}>
          {label}
        </T>
        <Money paisa={paisa} size={16} />
        {/* Forced RTL mirrors the layout but not the glyph, so pick the one that points inward. */}
        <MaterialCommunityIcons name={isUrdu ? 'chevron-left' : 'chevron-right'} size={22} color={colors.border} />
      </Row>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${(paisa / max) * 100}%`, backgroundColor: tint }]} />
      </View>
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
  // A comfortable touch target that still reads as one line of the card.
  share: { gap: space.xs, paddingVertical: space.sm, paddingHorizontal: space.xs, marginHorizontal: -space.xs, borderRadius: 8 },
});
