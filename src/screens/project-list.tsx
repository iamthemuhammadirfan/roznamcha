import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { type ComponentProps, type ReactNode, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  balancesByAssignment,
  useAllAssignments,
  useAllAttendance,
  useAllEntries,
  useAllExpenses,
  useProjectsLoaded,
} from '@/db/hooks';
import type { Project } from '@/db/schema';
import { activeOn, coverage } from '@/lib/attendance';
import { formatDay, today, weekday } from '@/lib/dates';
import { summarizeExpenses } from '@/lib/expenses';
import { useActiveProject } from '@/state/active-project';
import { useSession } from '@/state/session';
import { lang, t } from '@/i18n';
import { BalanceChip } from '@/ui/balance-chip';
import { Chip } from '@/ui/chip';
import { Banner, Empty, Row } from '@/ui/controls';
import { Fab } from '@/ui/fab';
import { SearchField } from '@/ui/search-field';
import { CodePlate, SiteBoard } from '@/ui/site-board';
import { NotSaved, UpdateBanner } from '@/ui/status-banners';
import { Money, Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

interface SiteSummary {
  workers: number;
  outstanding: number;
  expected: number;
  marked: number;
  spentThisMonth: number;
}

/**
 * Home: today's date like the top of a daybook page, then every project as its site
 * board — workers, today's haazri, this month's spending and what is owed. Tapping one
 * makes it the active project and opens its dashboard on top, so back returns here.
 */
/** Below this many projects every card fits on a screen or two, and a search bar is clutter. */
const SEARCH_FROM = 5;

type Filter = 'open' | 'pending' | 'closed';

export function ProjectList() {
  const { localMode } = useSession();
  const { projectId, setProjectId } = useActiveProject();
  const { projects, loading } = useProjectsLoaded();
  const assignments = useAllAssignments();
  const attendance = useAllAttendance();
  const balances = balancesByAssignment(attendance, useAllEntries());
  const expenses = useAllExpenses();
  const [filter, setFilter] = useState<Filter>('open');
  const [q, setQ] = useState('');

  const day = today();
  const markedToday = new Set(attendance.filter((r) => r.date === day).map((r) => r.assignment_id));

  const summary = (pid: string): SiteSummary => {
    const mine = assignments.filter((a) => a.project_id === pid);
    const expected = mine.filter((a) => activeOn(a, day));
    return {
      workers: mine.filter((a) => a.is_active).length,
      outstanding: mine.reduce((sum, a) => sum + (balances.get(a.id)?.balance ?? 0), 0),
      expected: expected.length,
      marked: expected.filter((a) => markedToday.has(a.id)).length,
      spentThisMonth: summarizeExpenses(
        expenses.filter((e) => e.project_id === pid),
        day,
      ).month,
    };
  };

  const rows = projects.map((p) => ({ p, s: summary(p.id) }));
  const open = rows.filter((r) => r.p.is_active);
  // "Attendance pending" is the owner's daily question: which sites haven't marked haazri yet.
  const pending = open.filter((r) => {
    const c = coverage(r.s.expected, r.s.marked);
    return c === 'missing' || c === 'partial';
  });
  const closed = rows.filter((r) => !r.p.is_active);

  const query = q.trim();
  const byFilter = filter === 'pending' ? pending : filter === 'closed' ? closed : open;
  const visible = query
    ? byFilter.filter((r) => r.p.code.includes(query) || r.p.name_ur.includes(query))
    : byFilter;

  function openProject(id: string) {
    setProjectId(id);
    router.push({ pathname: '/project/[id]', params: { id } });
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      {/* Fixed: today's date, then search and filters. Only the site boards scroll. */}
      <View style={styles.top}>
        <Row style={styles.dateLine}>
          <T variant="h1">{weekday(day, lang)}</T>
          <T variant="small" style={{ flex: 1 }}>
            {formatDay(day, lang)}
          </T>
        </Row>
        {projects.length >= SEARCH_FROM ? (
          <SearchField value={q} onChangeText={setQ} placeholder={t.project.search} />
        ) : null}
        {pending.length > 0 || closed.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.chips}>
            <Chip
              label={t.project.filterOpen}
              count={open.length}
              selected={filter === 'open'}
              onPress={() => setFilter('open')}
            />
            {pending.length > 0 ? (
              <Chip
                icon="calendar-alert"
                label={t.project.filterPending}
                count={pending.length}
                selected={filter === 'pending'}
                onPress={() => setFilter('pending')}
              />
            ) : null}
            {closed.length > 0 ? (
              <Chip
                icon="archive-outline"
                label={t.project.filterClosed}
                count={closed.length}
                selected={filter === 'closed'}
                onPress={() => setFilter('closed')}
              />
            ) : null}
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        data={visible}
        keyExtractor={(r) => r.p.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <>
            {localMode ? <Banner text={t.app.localMode} /> : null}
            <UpdateBanner />
            <NotSaved />
          </>
        }
        ListEmptyComponent={
          loading ? null : <Empty text={query || filter !== 'open' ? t.project.noMatch : t.project.empty} />
        }
        renderItem={({ item }) => (
          <ProjectBoard
            project={item.p}
            s={item.s}
            selected={item.p.id === projectId}
            onOpen={() => openProject(item.p.id)}
          />
        )}
      />

      <Fab icon="plus" label={t.project.new} onPress={() => router.push('/project-form')} />
    </SafeAreaView>
  );
}

function ProjectBoard({
  project: p,
  s,
  selected,
  onOpen,
}: {
  project: Project;
  s: SiteSummary;
  selected: boolean;
  onOpen: () => void;
}) {
  const state = coverage(s.expected, s.marked);
  return (
    <SiteBoard onPress={onOpen} selected={selected} muted={!p.is_active}>
      <Row style={{ alignItems: 'flex-start' }}>
        <CodePlate code={p.code} />
        <View style={{ flex: 1 }}>
          <T variant="h2">{p.name_ur}</T>
          {p.address ? <T variant="small">{p.address}</T> : null}
          {!p.is_active ? <T variant="small">{t.project.archived}</T> : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t.project.edit}
          hitSlop={16}
          onPress={() => router.push({ pathname: '/project-form', params: { id: p.id } })}
          style={styles.edit}>
          <MaterialCommunityIcons name="pencil-outline" size={22} color={colors.brand} />
        </Pressable>
      </Row>

      <View style={styles.facts}>
        <Fact icon="account-hard-hat">
          <Num bold>{s.workers}</Num>
          <T variant="small" style={styles.fill}>
            {t.project.workerCount}
          </T>
        </Fact>
        {state !== 'none' ? (
          <Fact
            icon={state === 'complete' ? 'calendar-check' : 'calendar-alert'}
            tint={state === 'complete' ? colors.owed : colors.pending}>
            {state === 'partial' ? (
              <>
                <Num bold style={{ color: colors.pending }}>
                  {s.marked}/{s.expected}
                </Num>
                <T variant="small" style={[styles.fill, { color: colors.pending }]}>
                  {t.attendance.marked}
                </T>
              </>
            ) : (
              <T variant="small" style={[styles.fill, { color: state === 'complete' ? colors.owed : colors.pending }]}>
                {state === 'complete' ? t.dashboard.attendanceDone : t.dashboard.attendanceMissing}
              </T>
            )}
          </Fact>
        ) : null}
        {s.spentThisMonth > 0 ? (
          <Fact icon="receipt-text-outline">
            <T variant="small" style={styles.fill}>
              {t.dashboard.spentThisMonth}
            </T>
            <Money paisa={s.spentThisMonth} size={15} />
          </Fact>
        ) : null}
      </View>

      <BalanceChip paisa={s.outstanding} />
    </SiteBoard>
  );
}

function Fact({
  icon,
  tint = colors.muted,
  children,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  tint?: string;
  children: ReactNode;
}) {
  return (
    <Row style={{ gap: space.xs }}>
      <MaterialCommunityIcons name={icon} size={20} color={tint} />
      {children}
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: { gap: space.sm, alignItems: 'center' },
  // Room under the last board so the floating button never hides it.
  list: { padding: space.lg, paddingBottom: 96, gap: space.md, flexGrow: 1 },
  dateLine: { paddingHorizontal: space.xs },
  edit: { padding: space.xs },
  fill: { flex: 1 },
  // One fact per line, each label filling its row: Android mis-measures shrink-wrapped
  // Nastaliq and drops the last word.
  facts: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.sm,
  },
});
