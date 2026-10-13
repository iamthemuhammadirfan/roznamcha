import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  balancesByAssignment,
  useProject,
  useProjectAssignments,
  useProjectAttendance,
  useProjectEntries,
  useProjectExpenses,
} from '@/db/hooks';
import { activeOn, coverage } from '@/lib/attendance';
import { presetRange, today } from '@/lib/dates';
import { projectSpend } from '@/lib/expenses';
import { useSession } from '@/state/session';
import { isUrdu, t } from '@/i18n';
import { BalanceChip } from '@/ui/balance-chip';
import { Banner, Card, Empty, Row, Screen } from '@/ui/controls';
import { CodePlate, SiteBoard } from '@/ui/site-board';
import { Money, Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

/**
 * One project's dashboard, pushed from the project list on Home. Back returns to the
 * list. The list sets this as the active project before opening it, so the header,
 * new entries, expenses and assignments are all scoped to it.
 */
export default function ProjectDashboard() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { localMode } = useSession();
  const project = useProject(id);
  const assignments = useProjectAssignments(id);
  const attendance = useProjectAttendance(id);
  const entries = useProjectEntries(id);
  const balances = balancesByAssignment(attendance, entries);
  // Spending = cash handed to workers + site expenses, same as the expenses screen.
  const siteRows = useProjectExpenses(id);
  const expenses = {
    month: projectSpend(siteRows, entries, presetRange('month', today())).total,
    total: projectSpend(siteRows, entries, presetRange('all', today())).total,
  };

  if (!project) return <Empty text={t.project.empty} />;

  const outstanding = assignments.reduce((s, a) => s + (balances.get(a.id)?.balance ?? 0), 0);
  const active = assignments.filter((a) => a.is_active).length;

  const day = today();
  const expected = assignments.filter((a) => activeOn(a, day));
  const markedToday = new Set(attendance.filter((r) => r.date === day).map((r) => r.assignment_id));
  const marked = expected.filter((a) => markedToday.has(a.id)).length;
  const todayState = coverage(expected.length, marked);

  return (
    <Screen>
      {localMode ? <Banner text={t.app.localMode} /> : null}

      <SiteBoard>
        <Row style={{ alignItems: 'flex-start' }}>
          <CodePlate code={project.code} size={30} />
          <View style={{ flex: 1 }}>
            <T variant="h1">{project.name_ur}</T>
            {project.address ? <T variant="small">{project.address}</T> : null}
          </View>
        </Row>
        <T variant="small">{t.balance.total}</T>
        <BalanceChip paisa={outstanding} size={22} />
      </SiteBoard>

      <View style={styles.actions}>
        <ActionTile icon="hand-coin-outline" label={t.dashboard.giveEntry} primary onPress={() => router.push('/entry')} />
        <ActionTile icon="receipt-text-plus-outline" label={t.dashboard.addExpense} onPress={() => router.push('/expense')} />
        <ActionTile icon="calendar-check" label={t.dashboard.markAttendance} onPress={() => router.push('/attendance')} />
      </View>

      {expected.length > 0 ? (
        <Card
          onPress={() => router.push({ pathname: '/attendance-day', params: { date: day } })}
          style={{ backgroundColor: todayState === 'complete' ? colors.owedSoft : colors.pendingSoft }}>
          <Row style={{ justifyContent: 'space-between' }}>
            {/* Fill the row: Android mis-measures shrink-wrapped Nastaliq and drops the last word. */}
            <T variant="h2" style={{ flex: 1 }}>
              {t.dashboard.todayAttendance}
            </T>
            {todayState === 'missing' ? (
              <T variant="bodyBold" style={{ color: colors.pending }}>
                {t.attendance.notMarked}
              </T>
            ) : (
              // Urdu reads "15 میں سے 12" (12 out of 15); English "12 of 15".
              <Row>
                <Num bold style={{ fontSize: 20 }}>
                  {isUrdu ? expected.length : marked}
                </Num>
                <T variant="small">{t.attendance.of}</T>
                <Num bold style={{ fontSize: 20 }}>
                  {isUrdu ? marked : expected.length}
                </Num>
                <T variant="small">{t.attendance.marked}</T>
              </Row>
            )}
          </Row>
        </Card>
      ) : null}

      <Card onPress={() => router.push('/project-expenses')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ flexShrink: 1 }}>
            <MaterialCommunityIcons name="receipt-text-outline" size={24} color={colors.brand} />
            <T variant="h2">{t.expense.title}</T>
          </Row>
          <Money paisa={expenses.month} size={20} />
        </Row>
        <Row style={{ justifyContent: 'space-between' }}>
          <T variant="small">{t.expense.month}</T>
          <Row>
            <T variant="small">{t.expense.total}</T>
            <Money paisa={expenses.total} size={15} color={colors.muted} />
          </Row>
        </Row>
      </Card>

      <Card onPress={() => router.push('/project-workers')}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row style={{ flexShrink: 1 }}>
            <MaterialCommunityIcons name="account-hard-hat" size={24} color={colors.brand} />
            <T variant="h2">{t.dashboard.workersOnProject}</T>
          </Row>
          <Num bold style={{ fontSize: 22 }}>
            {active}
          </Num>
        </Row>
      </Card>
    </Screen>
  );
}

/** The three things done on site every day, as big icon tiles a dusty thumb can't miss. */
function ActionTile({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const fg = primary ? colors.white : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        primary ? styles.tilePrimary : styles.tileSecondary,
        pressed && { opacity: 0.8 },
      ]}>
      <MaterialCommunityIcons name={icon} size={34} color={fg} />
      <T variant="bodyBold" style={{ color: fg, textAlign: 'center', alignSelf: 'stretch' }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: space.sm },
  tile: {
    flex: 1,
    minHeight: 112,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    padding: space.sm,
  },
  tilePrimary: { backgroundColor: colors.brand },
  tileSecondary: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.brand },
});
