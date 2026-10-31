import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, useLocalSearchParams } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  balancesByAssignment,
  useProject,
  useProjectAssignments,
  useProjectAttendance,
  useProjectEntries,
} from '@/db/hooks';
import { addEntry, type NewEntryKind } from '@/db/mutations';
import { daysBetween, today } from '@/lib/dates';
import { parseRupees } from '@/lib/money';
import { useActiveProject } from '@/state/active-project';
import { useWriteContext } from '@/state/session';
import { t } from '@/i18n';
import { AmountInput } from '@/ui/amount-input';
import { BalanceChip } from '@/ui/balance-chip';
import { Banner, Button, Field, Row } from '@/ui/controls';
import { DateField } from '@/ui/date-field';
import { useKeyboardHeight } from '@/ui/keyboard';
import { SearchField } from '@/ui/search-field';
import { CodePlate } from '@/ui/site-board';
import { T } from '@/ui/text';
import { colors, space, TOUCH_MIN } from '@/ui/theme';
import { WorkerAvatar } from '@/ui/worker-avatar';

const KINDS: { value: NewEntryKind; label: string; icon: ComponentProps<typeof MaterialCommunityIcons>['name'] }[] = [
  { value: 'advance', label: t.entry.advance, icon: 'hand-coin-outline' },
  { value: 'payment', label: t.entry.payment, icon: 'cash-check' },
  // Cash coming back from the worker: lowers what he owes.
  { value: 'repayment', label: t.entry.repayment, icon: 'cash-refund' },
];

/**
 * Money between the business and a worker on the active project, written like a cash
 * slip: who, what kind, how much — with the worker's balance before and after shown
 * right under the amount, so both sides see the effect before the cash changes hands.
 * An advance or payment goes to the worker; a واپسی (repayment) comes back from him.
 * Saving goes straight to the parchi.
 */
export default function NewEntry() {
  const params = useLocalSearchParams<{ workerId?: string }>();
  const { projectId } = useActiveProject();
  const pid = projectId ?? '';
  const project = useProject(projectId ?? null);
  const assignments = useProjectAssignments(pid).filter((a) => a.is_active);
  const balances = balancesByAssignment(useProjectAttendance(pid), useProjectEntries(pid));
  const ctx = useWriteContext();
  const keyboard = useKeyboardHeight();

  // undefined = nothing chosen yet (fall back to the worker we came from); null = cleared.
  const [assignmentId, setAssignmentId] = useState<string | null | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [kind, setKind] = useState<NewEntryKind>('advance');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const preselected = params.workerId ? assignments.find((a) => a.worker_id === params.workerId) : undefined;
  const selected =
    assignmentId === undefined ? (preselected ?? null) : (assignments.find((a) => a.id === assignmentId) ?? null);
  const matches = assignments.filter((a) => !search.trim() || a.worker_name.includes(search.trim()));

  const paisa = parseRupees(amount) ?? 0;
  const balanceNow = selected ? (balances.get(selected.id)?.balance ?? 0) : 0;
  const back = daysBetween(date, today());
  const repaying = kind === 'repayment';
  // Money going to the worker lowers what we owe him; money coming back raises it.
  const balanceAfter = repaying ? balanceNow + paisa : balanceNow - paisa;
  // What he owes us right now (0 if we owe him).
  const owes = Math.max(0, -balanceNow);

  async function commit() {
    setBusy(true);
    const id = await addEntry(ctx, { assignmentId: selected!.id, kind, amountPaisa: paisa, date, note });
    router.replace({ pathname: '/receipt/[id]', params: { id } });
  }

  function save() {
    if (!selected) return setError(t.entry.workerRequired);
    if (!parseRupees(amount)) return setError(t.entry.amountRequired);
    if (back < 0) return setError(t.entry.futureDate);
    setError(null);
    // Handing back more than he owes is almost always a typo (400,000 for 40,000), but
    // it can be real, so ask rather than refuse.
    if (repaying && paisa > owes) {
      Alert.alert(t.entry.repayTooMuchTitle, t.entry.repayTooMuchBody, [
        { text: t.action.cancel, style: 'cancel' },
        { text: t.action.confirm, onPress: confirmDate },
      ]);
      return;
    }
    confirmDate();
  }

  function confirmDate() {
    if (back > 7) {
      Alert.alert(t.entry.backdateTitle, t.entry.backdateBody, [
        { text: t.action.cancel, style: 'cancel' },
        { text: t.action.confirm, onPress: commit },
      ]);
      return;
    }
    commit();
  }

  return (
    // Lifted by the keyboard's height so the pinned save button stays above it.
    <SafeAreaView edges={['bottom']} style={[styles.screen, keyboard > 0 && { paddingBottom: keyboard }]}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* Which site this money goes against — the header shows it too, but this is the moment it matters. */}
        <Row>
          <CodePlate code={project?.code ?? ''} size={18} />
          <T variant="bodyBold" style={{ flex: 1 }}>
            {project?.name_ur}
          </T>
        </Row>

        {error ? <Banner tone="recover" text={error} /> : null}

        {selected ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.entry.changeWorker}
            onPress={() => setAssignmentId(null)}
            style={[styles.pick, styles.picked]}>
            <WorkerAvatar name={selected.worker_name} size={44} />
            <View style={{ flex: 1 }}>
              <T variant="h2" style={{ color: colors.white, fontSize: 20 }}>
                {selected.worker_name}
              </T>
              {selected.worker_father_name ? (
                <T variant="small" style={{ color: colors.brandSoft }}>
                  {t.worker.son} {selected.worker_father_name}
                </T>
              ) : null}
            </View>
            <MaterialCommunityIcons name="close" size={24} color={colors.white} />
          </Pressable>
        ) : (
          <View style={{ gap: space.sm }}>
            <T variant="bodyBold">{t.entry.pickWorker}</T>
            {assignments.length > 6 ? (
              <SearchField value={search} onChangeText={setSearch} placeholder={t.worker.search} />
            ) : null}
            {matches.map((a) => (
              <Pressable
                key={a.id}
                onPress={() => setAssignmentId(a.id)}
                style={({ pressed }) => [styles.pick, pressed && { backgroundColor: colors.brandSoft }]}>
                <WorkerAvatar name={a.worker_name} size={40} />
                <View style={{ flex: 1 }}>
                  <T variant="h2" style={{ fontSize: 20 }}>
                    {a.worker_name}
                  </T>
                  {a.worker_father_name ? (
                    <T variant="small">
                      {t.worker.son} {a.worker_father_name}
                    </T>
                  ) : null}
                </View>
                <BalanceChip paisa={balances.get(a.id)?.balance ?? 0} size={14} />
              </Pressable>
            ))}
          </View>
        )}

        <View style={styles.segment}>
          {KINDS.map((k) => {
            const on = k.value === kind;
            return (
              <Pressable
                key={k.value}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setKind(k.value)}
                style={[styles.segmentItem, on && styles.segmentOn]}>
                <MaterialCommunityIcons name={k.icon} size={24} color={on ? colors.white : colors.brand} />
                <T variant="h2" style={{ color: on ? colors.white : colors.brand }}>
                  {k.label}
                </T>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.slip}>
          {repaying ? <T variant="small">{t.entry.repayHelp}</T> : null}
          <AmountInput value={amount} onChange={setAmount} />
          {selected ? (
            // What the parchi will say. Advances and payments lower what we owe; a
            // repayment lowers what he owes.
            <View style={styles.preview}>
              <View style={styles.previewCell}>
                <T variant="small">{t.entry.balanceNow}</T>
                <BalanceChip paisa={balanceNow} size={15} />
              </View>
              <View style={styles.previewCell}>
                <T variant="small">{t.entry.balanceAfter}</T>
                <BalanceChip paisa={balanceAfter} size={15} />
              </View>
            </View>
          ) : null}
        </View>

        <DateField inline label={t.entry.date} value={date} onChange={setDate} />
        {back > 7 ? <Banner text={t.entry.backdateBody} /> : null}

        <Field label={t.entry.note} value={note} onChangeText={setNote} />
      </ScrollView>

      <View style={styles.footer}>
        <Button label={t.entry.saveAndReceipt} onPress={save} busy={busy} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.md },
  pick: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  picked: { backgroundColor: colors.brand, borderColor: colors.brand },
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.brand,
    overflow: 'hidden',
  },
  // Three kinds side by side: the icon sits above the word so each fits a third.
  segmentItem: {
    flex: 1,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs,
  },
  segmentOn: { backgroundColor: colors.brand },
  // The slip: the amount is the point of this screen, so it gets the size.
  slip: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  preview: {
    flexDirection: 'row',
    gap: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: space.sm,
  },
  previewCell: { flex: 1, gap: space.xs, alignItems: 'flex-start' },
  footer: {
    padding: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
});
