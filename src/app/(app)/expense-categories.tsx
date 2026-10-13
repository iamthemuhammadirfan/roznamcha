import { useState } from 'react';
import { Alert } from 'react-native';

import { useExpenseCategories } from '@/db/hooks';
import { addExpenseCategory, renameExpenseCategory, setExpenseCategoryActive } from '@/db/mutations';
import type { ExpenseCategory } from '@/db/schema';
import { expenseCategoryLabel, t } from '@/i18n';
import { useMember, useWriteContext } from '@/state/session';
import { AddBar } from '@/ui/add-bar';
import { Banner, Empty, Screen } from '@/ui/controls';
import { EditRow, IconAction, ListGroup, ListRow } from '@/ui/list-group';

const fold = (s: string) => s.trim().toLowerCase();

/**
 * Owner's list of expense types. Expenses point at a type by id, so types are hidden
 * instead of deleted, and a rename relabels past expenses too. The box at the bottom
 * both searches and adds; typing a hidden type's name finds it so it can be shown again.
 */
export default function ExpenseCategoriesScreen() {
  const categories = useExpenseCategories();
  const ctx = useWriteContext();
  const { role } = useMember();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (role !== 'owner') {
    return (
      <Screen>
        <Banner text={t.expense.ownerOnly} />
      </Screen>
    );
  }

  const q = fold(name);
  // Matches the stored name or how it's shown, so "Diesel" finds ڈیزل / تیل in English.
  const hit = (c: ExpenseCategory) => !q || fold(c.name).includes(q) || fold(expenseCategoryLabel(c.name)).includes(q);
  const active = categories.filter((c) => c.is_active && hit(c));
  const hidden = categories.filter((c) => !c.is_active && hit(c));
  // A hidden match isn't blocked: adding it shows it again (addExpenseCategory does that).
  const exists =
    Boolean(q) &&
    categories.some((c) => c.is_active && (fold(c.name) === q || fold(expenseCategoryLabel(c.name)) === q));

  async function add() {
    if (!name.trim()) return;
    if (await addExpenseCategory(ctx, name)) {
      setName('');
      setError(null);
    } else {
      setError(t.expense.duplicate);
    }
  }

  return (
    <Screen
      footer={
        <AddBar
          value={name}
          onChangeText={setName}
          placeholder={t.list.searchOrAdd}
          addLabel={t.trades.add}
          blocked={exists ? t.list.exists : null}
          onAdd={add}
        />
      }>
      {error ? <Banner tone="recover" text={error} /> : null}

      {categories.length === 0 && !q ? <Empty text={t.expense.categoriesEmpty} /> : null}
      {q && active.length === 0 && hidden.length === 0 ? <Empty text={t.list.noMatch} /> : null}

      <ListGroup>
        {active.map((c) => (
          <CategoryRow key={c.id} category={c} onError={setError} />
        ))}
      </ListGroup>

      <ListGroup title={hidden.length ? t.expense.hidden : undefined}>
        {hidden.map((c) => (
          <ListRow key={c.id} label={expenseCategoryLabel(c.name)} muted>
            <IconAction
              icon="eye-outline"
              label={t.expense.show}
              onPress={() => setExpenseCategoryActive(c.id, true)}
            />
          </ListRow>
        ))}
      </ListGroup>
    </Screen>
  );
}

function CategoryRow({ category, onError }: { category: ExpenseCategory; onError: (e: string | null) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(category.name);

  async function save() {
    if (await renameExpenseCategory(category.id, draft)) {
      onError(null);
      setEditing(false);
    } else {
      onError(t.expense.duplicate);
    }
  }

  function cancel() {
    setDraft(category.name);
    onError(null);
    setEditing(false);
  }

  function confirmHide() {
    Alert.alert(`${expenseCategoryLabel(category.name)} — ${t.expense.hide}?`, t.expense.hideHelp, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.expense.hide, style: 'destructive', onPress: () => setExpenseCategoryActive(category.id, false) },
    ]);
  }

  if (editing) {
    return (
      <EditRow
        value={draft}
        onChangeText={setDraft}
        onSave={save}
        onCancel={cancel}
        saveLabel={t.trades.save}
        cancelLabel={t.action.cancel}
      />
    );
  }

  return (
    <ListRow label={expenseCategoryLabel(category.name)}>
      <IconAction icon="pencil-outline" label={t.action.edit} onPress={() => setEditing(true)} />
      <IconAction icon="eye-off-outline" label={t.expense.hide} tone="danger" onPress={confirmHide} />
    </ListRow>
  );
}
