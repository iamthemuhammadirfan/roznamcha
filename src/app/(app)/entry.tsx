import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useProject, useProjectAssignments } from '@/db/hooks';
import { addEntry, type NewEntryKind } from '@/db/mutations';
import { addDays, daysBetween, formatDayUr, today, weekdayUr } from '@/lib/dates';
import { parseRupees } from '@/lib/money';
import { useActiveProject } from '@/state/active-project';
import { useWriteContext } from '@/state/session';
import { ur } from '@/strings.ur';
import { Banner, Button, Card, Choice, Field, Row, Screen } from '@/ui/controls';
import { Num, T } from '@/ui/text';
import { colors, space, TOUCH_MIN } from '@/ui/theme';

const KINDS: { value: NewEntryKind; label: string }[] = [
  { value: 'advance', label: ur.entry.advance },
  { value: 'payment', label: ur.entry.payment },
];

export default function NewEntry() {
  const params = useLocalSearchParams<{ workerId?: string }>();
  const { projectId } = useActiveProject();
  const project = useProject(projectId ?? null);
  const assignments = useProjectAssignments(projectId ?? '').filter((a) => a.is_active);
  const ctx = useWriteContext();

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

  const back = daysBetween(date, today());

  async function commit() {
    setBusy(true);
    const id = await addEntry(ctx, {
      assignmentId: selected!.id,
      kind,
      amountPaisa: parseRupees(amount)!,
      date,
      note,
    });
    router.replace({ pathname: '/receipt/[id]', params: { id } });
  }

  function save() {
    if (!selected) return setError(ur.entry.workerRequired);
    if (!parseRupees(amount)) return setError(ur.entry.amountRequired);
    if (back < 0) return setError(ur.entry.futureDate);
    if (back > 7) {
      Alert.alert(ur.entry.backdateTitle, ur.entry.backdateBody, [
        { text: ur.action.cancel, style: 'cancel' },
        { text: ur.action.confirm, onPress: commit },
      ]);
      return;
    }
    commit();
  }

  return (
    <Screen>
      <Card style={{ backgroundColor: colors.brandSoft }}>
        <Row>
          <T variant="small">{ur.receipt.project}</T>
          <Num bold style={{ fontSize: 24, lineHeight: 36, color: colors.brand }}>
            {project?.code}
          </Num>
          <T variant="h2">{project?.name_ur}</T>
        </Row>
      </Card>

      {error ? <Banner tone="recover" text={error} /> : null}

      <T variant="bodyBold">{ur.entry.worker}</T>
      {selected ? (
        <Pressable onPress={() => setAssignmentId(null)} style={[styles.pick, styles.picked]}>
          <T variant="h2" style={{ color: colors.white, fontSize: 20 }}>
            {selected.worker_name}
          </T>
          {selected.worker_father_name ? (
            <T variant="small" style={{ color: colors.white }}>
              {ur.worker.son} {selected.worker_father_name}
            </T>
          ) : null}
        </Pressable>
      ) : (
        <View style={{ gap: space.sm }}>
          {assignments.length > 6 ? <Field label={ur.worker.search} value={search} onChangeText={setSearch} /> : null}
          {matches.map((a) => (
            <Pressable key={a.id} onPress={() => setAssignmentId(a.id)} style={styles.pick}>
              <T variant="h2" style={{ fontSize: 20 }}>
                {a.worker_name}
              </T>
              {a.worker_father_name ? (
                <T variant="small">
                  {ur.worker.son} {a.worker_father_name}
                </T>
              ) : null}
            </Pressable>
          ))}
        </View>
      )}

      <T variant="bodyBold">{ur.entry.kind}</T>
      <Choice options={KINDS} value={kind} onChange={setKind} />

      <Field label={ur.entry.amount} value={amount} onChangeText={setAmount} numeric />

      <T variant="bodyBold">{ur.entry.date}</T>
      {/* The relative word is never shown alone — کل means both yesterday and tomorrow. */}
      <Row style={{ justifyContent: 'space-between' }}>
        <Pressable onPress={() => setDate(addDays(date, 1))} disabled={back <= 0} style={styles.step}>
          <T variant="h1" style={{ color: back <= 0 ? colors.border : colors.brand }}>
            +
          </T>
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <T variant="h2">
            {weekdayUr(date)} {formatDayUr(date)}
          </T>
          {back === 0 ? <T variant="small">{ur.date.today}</T> : null}
          {back === 1 ? <T variant="small">{ur.date.yesterday}</T> : null}
        </View>
        <Pressable onPress={() => setDate(addDays(date, -1))} style={styles.step}>
          <T variant="h1" style={{ color: colors.brand }}>
            −
          </T>
        </Pressable>
      </Row>
      {back > 7 ? <Banner text={ur.entry.backdateBody} /> : null}

      <Field label={ur.entry.note} value={note} onChangeText={setNote} />

      <Button label={ur.action.save} onPress={save} busy={busy} style={{ minHeight: 72 }} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  pick: {
    minHeight: TOUCH_MIN,
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  picked: { backgroundColor: colors.brand, borderColor: colors.brand },
  step: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
