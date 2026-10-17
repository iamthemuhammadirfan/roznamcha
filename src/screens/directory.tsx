import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, FlatList, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAllAssignments, useProjects, useWorkers } from '@/db/hooks';
import type { Project, Worker } from '@/db/schema';
import { useActiveProject } from '@/state/active-project';
import { t, tradeLabel } from '@/i18n';
import { Chip } from '@/ui/chip';
import { Empty, Row } from '@/ui/controls';
import { Fab } from '@/ui/fab';
import { SearchField } from '@/ui/search-field';
import { Num, T } from '@/ui/text';
import { colors, space, TOUCH_MIN } from '@/ui/theme';
import { WorkerAvatar } from '@/ui/worker-avatar';

const AVATAR = 44;
/** Plates shown per row; the rest fold into a "+N" so the father's name keeps its room. */
const MAX_PLATES = 2;

/**
 * The global worker directory. As a tab, tapping a person opens their ledger. In pick
 * mode ("add worker" on a project) tapping a person goes on to assign them to the
 * active project — searching here first is what stops duplicate people, which is why
 * "create new" is the quieter outlined button in that mode.
 *
 * Search and filters stay fixed at the top; only the list scrolls, as compact rows so a
 * screenful shows six or seven people rather than two.
 */
export function Directory({ picking = false }: { picking?: boolean }) {
  const { projectId } = useActiveProject();
  const workers = useWorkers();
  const assignments = useAllAssignments();
  const projects = useProjects();
  const [q, setQ] = useState('');
  const [trade, setTrade] = useState<string | null>(null);

  const projectOf = new Map(projects.map((p) => [p.id, p]));
  const query = q.trim();
  const digits = query.replace(/\D/g, '');
  const matches = workers.filter((w) => {
    if (!query) return true;
    if (digits.length >= 3 && w.phone?.replace(/\D/g, '').includes(digits)) return true;
    return w.name_ur.includes(query) || (w.father_name ?? '').includes(query);
  });
  // Only trades someone actually has, most common first.
  const tradeCounts = new Map<string, number>();
  for (const w of matches) if (w.trade) tradeCounts.set(w.trade, (tradeCounts.get(w.trade) ?? 0) + 1);
  const trades = [...tradeCounts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
  const filtered = trade ? matches.filter((w) => w.trade === trade) : matches;

  // Each project once (a rejoin is a second assignment), by code so rows read alike.
  const sitesOf = (workerId: string) =>
    [
      ...new Set(
        assignments
          .filter((a) => a.worker_id === workerId && a.is_active)
          .map((a) => projectOf.get(a.project_id))
          .filter((p) => p !== undefined),
      ),
    ].sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));

  function onPick(workerId: string) {
    if (!picking) {
      router.push({ pathname: '/worker/[id]', params: { id: workerId } });
      return;
    }
    const already = assignments.some((a) => a.worker_id === workerId && a.project_id === projectId && a.is_active);
    if (already) {
      Alert.alert(t.assignment.alreadyOn);
      return;
    }
    router.push({ pathname: '/assign', params: { workerId } });
  }

  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <View style={styles.top}>
        <SearchField value={q} onChangeText={setQ} placeholder={t.worker.search} autoFocus={picking} />
        {trades.length > 1 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.chips}>
            <Chip label={t.worker.allTrades} selected={trade === null} onPress={() => setTrade(null)} />
            {trades.map((n) => (
              <Chip key={n} label={tradeLabel(n)} selected={trade === n} onPress={() => setTrade(n)} />
            ))}
          </ScrollView>
        ) : null}
        <Row style={{ gap: space.xs }}>
          <Num bold>{filtered.length}</Num>
          <T variant="small" style={{ flex: 1 }}>
            {t.worker.count}
          </T>
        </Row>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(w) => w.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Empty text={t.worker.notFound} />}
        ItemSeparatorComponent={() => (
          <View style={styles.dividerWrap}>
            <View style={styles.divider} />
          </View>
        )}
        renderItem={({ item, index }) => (
          <WorkerRow
            w={item}
            sites={sitesOf(item.id)}
            first={index === 0}
            last={index === filtered.length - 1}
            onPress={() => onPick(item.id)}
          />
        )}
      />

      <Fab
        icon="account-plus-outline"
        label={t.worker.createNew}
        quiet={picking}
        onPress={() =>
          router.push({ pathname: '/worker-form', params: picking ? { assign: '1', name: query } : { name: query } })
        }
      />
    </SafeAreaView>
  );
}

function WorkerRow({
  w,
  sites,
  first,
  last,
  onPress,
}: {
  w: Worker;
  sites: Project[];
  first: boolean;
  last: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        first && styles.rowFirst,
        last && styles.rowLast,
        pressed && { backgroundColor: colors.brandSoft },
      ]}>
      <WorkerAvatar name={w.name_ur} size={AVATAR} />
      <View style={{ flex: 1 }}>
        <Row style={{ gap: space.sm }}>
          <T variant="bodyBold" numberOfLines={1} style={{ flex: 1 }}>
            {w.name_ur}
          </T>
          {w.trade ? (
            <View style={styles.trade}>
              <T variant="small" style={{ color: colors.brand, fontSize: 14, lineHeight: 28 }}>
                {tradeLabel(w.trade)}
              </T>
            </View>
          ) : null}
        </Row>
        <Row style={{ gap: space.sm }}>
          <T variant="small" numberOfLines={1} style={{ flex: 1 }}>
            {w.father_name ? `${t.worker.son} ${w.father_name}` : ''}
          </T>
          {/* Where he works now: crane + the sites' yellow numbers, so they can't be read as money. */}
          {sites.length > 0 ? <Sites sites={sites} /> : null}
        </Row>
      </View>
    </Pressable>
  );
}

/** One crane, the first few site plates, then "+N" for the rest (all are on his ledger). */
function Sites({ sites }: { sites: Project[] }) {
  const shown = sites.slice(0, MAX_PLATES);
  const more = sites.length - shown.length;
  return (
    <Row style={{ gap: 4 }}>
      <MaterialCommunityIcons name="crane" size={16} color={colors.muted} />
      {shown.map((p) => (
        <View key={p.id} style={styles.plate}>
          <Num bold style={styles.plateText}>
            {p.code}
          </Num>
        </View>
      ))}
      {more > 0 ? (
        <View style={styles.more}>
          {/* LRM first: Android ignores writingDirection, and RTL would print "2+". */}
          <Num bold style={styles.moreText}>{`\u200E+${more}`}</Num>
        </View>
      ) : null}
    </Row>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  top: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chips: { gap: space.sm, alignItems: 'center' },
  // Room under the last row so the floating button never hides it.
  list: { padding: space.lg, paddingBottom: 96, flexGrow: 1 },
  row: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderStartWidth: 1,
    borderEndWidth: 1,
    borderColor: colors.border,
  },
  rowFirst: { borderTopWidth: 1, borderTopStartRadius: 14, borderTopEndRadius: 14 },
  rowLast: { borderBottomWidth: 1, borderBottomStartRadius: 14, borderBottomEndRadius: 14 },
  // The separator carries the list's side borders, so the outline has no gaps.
  dividerWrap: { backgroundColor: colors.card, borderStartWidth: 1, borderEndWidth: 1, borderColor: colors.border },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginStart: space.md + AVATAR + space.md,
  },
  trade: { backgroundColor: colors.brandSoft, borderRadius: 999, paddingHorizontal: space.sm },
  plate: {
    backgroundColor: colors.site,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.siteInk,
    paddingHorizontal: 5,
  },
  plateText: { fontSize: 13, lineHeight: 20, color: colors.siteInk },
  more: { backgroundColor: colors.bg, borderRadius: 5, borderWidth: 1.5, borderColor: colors.border, paddingHorizontal: 5 },
  moreText: { fontSize: 13, lineHeight: 20, color: colors.muted },
});
