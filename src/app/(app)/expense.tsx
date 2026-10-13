import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useExpenseCategories, useProject } from '@/db/hooks';
import { addExpense } from '@/db/mutations';
import { daysBetween, today } from '@/lib/dates';
import { parseRupees } from '@/lib/money';
import { useActiveProject } from '@/state/active-project';
import { useWriteContext } from '@/state/session';
import { expenseCategoryLabel, t } from '@/i18n';
import { Banner, Button, Card, Choice, Field, Row, Screen } from '@/ui/controls';
import { AmountInput } from '@/ui/amount-input';
import { DateField } from '@/ui/date-field';
import { CodePlate } from '@/ui/site-board';
import { T } from '@/ui/text';

/** A site expense against the active project — not tied to any worker. */
export default function NewExpense() {
  const { projectId } = useActiveProject();
  const project = useProject(projectId ?? null);
  const categories = useExpenseCategories().filter((c) => c.is_active);
  const ctx = useWriteContext();

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const back = daysBetween(date, today());

  async function commit() {
    setBusy(true);
    await addExpense(ctx, {
      projectId: projectId!,
      categoryId: categoryId!,
      amountPaisa: parseRupees(amount)!,
      date,
      note,
    });
    router.back();
  }

  function save() {
    if (!projectId) return;
    if (!categoryId) return setError(t.expense.categoryRequired);
    if (!parseRupees(amount)) return setError(t.entry.amountRequired);
    if (back < 0) return setError(t.entry.futureDate);
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
    <Screen footer={<Button icon="content-save-outline" label={t.action.save} onPress={save} busy={busy} />}>
      {/* Which site this money goes against — the header shows it too, but this is the moment it matters. */}
      <Row>
        <CodePlate code={project?.code ?? ''} size={18} />
        <T variant="bodyBold" style={{ flex: 1 }}>
          {project?.name_ur}
        </T>
      </Row>

      {error ? <Banner tone="recover" text={error} /> : null}

      <T variant="bodyBold">{t.expense.category}</T>
      {categories.length === 0 ? (
        <Banner text={t.expense.noCategories} />
      ) : (
        <Choice
          options={categories.map((c) => ({ value: c.id, label: expenseCategoryLabel(c.name) }))}
          value={categoryId ?? ''}
          onChange={setCategoryId}
        />
      )}

      <Card>
        <AmountInput value={amount} onChange={setAmount} />
      </Card>

      <DateField inline label={t.entry.date} value={date} onChange={setDate} />
      {back > 7 ? <Banner text={t.entry.backdateBody} /> : null}

      <Field label={t.entry.note} value={note} onChangeText={setNote} />
    </Screen>
  );
}
