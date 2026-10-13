import { useDeferredValue, useState } from 'react';
import { FlatList } from 'react-native';

import { useExpenseCategories } from '@/db/hooks';
import { addExpenseCategory, renameExpenseCategory, setExpenseCategoryActive } from '@/db/mutations';
import type { ExpenseCategory } from '@/db/schema';
import { expenseCategoryLabel, t } from '@/i18n';
import { useMember, useWriteContext } from '@/state/session';
import { AddBar } from '@/ui/add-bar';
import { EditRow, IconAction, ListRow, SectionTitle } from '@/ui/list-group';
import { ListStage } from '@/ui/site-status';
import { ChoiceDialog } from '@/ui/tamagui-dialog';
import { Banner, Empty, ListScreen } from '@/ui/tamagui-screen';

const fold = (s: string) => s.trim().toLowerCase();

type Item =
  | { kind: 'category'; key: string; category: ExpenseCategory; divider: boolean }
  | { kind: 'title'; key: string };

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
  // The list filters on a deferred copy, so typing never waits for it.
  const query = useDeferredValue(name);
  const [error, setError] = useState<string | null>(null);
  // One row is renamed at a time, and one dialog serves every row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [hiding, setHiding] = useState<ExpenseCategory | null>(null);

  if (role !== 'owner') {
    return (
      <ListScreen>
        <Banner text={t.expense.ownerOnly} />
      </ListScreen>
    );
  }

  const q = fold(query);
  // Matches the stored name or how it's shown, so "Diesel" finds ڈیزل / تیل in English.
  const hit = (c: ExpenseCategory) => !q || fold(c.name).includes(q) || fold(expenseCategoryLabel(c.name)).includes(q);
  const active = categories.filter((c) => c.is_active && hit(c));
  const hidden = categories.filter((c) => !c.is_active && hit(c));
  const typed = fold(name);
  // A hidden match isn't blocked: adding it shows it again (addExpenseCategory does that).
  const exists =
    Boolean(typed) &&
    categories.some((c) => c.is_active && (fold(c.name) === typed || fold(expenseCategoryLabel(c.name)) === typed));

  const items: Item[] = [
    ...active.map((c, i) => ({ kind: 'category' as const, key: c.id, category: c, divider: i > 0 })),
    ...(hidden.length ? [{ kind: 'title' as const, key: 'hidden-title' }] : []),
    ...hidden.map((c, i) => ({ kind: 'category' as const, key: c.id, category: c, divider: i > 0 })),
  ];

  async function add() {
    if (!name.trim()) return;
    if (await addExpenseCategory(ctx, name)) {
      setName('');
      setError(null);
    } else {
      setError(t.expense.duplicate);
    }
  }

  async function rename(category: ExpenseCategory, draft: string) {
    if (await renameExpenseCategory(category.id, draft)) {
      setError(null);
      setEditingId(null);
    } else {
      setError(t.expense.duplicate);
    }
  }

  return (
    <ListScreen
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
      <FlatList
        data={items}
        keyExtractor={(item) => item.key}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        ListHeaderComponent={
          <>
            <ListStage
              readouts={[
                { label: t.list.inList, value: String(categories.filter((c) => c.is_active).length) },
                { label: t.expense.hidden, value: String(categories.filter((c) => !c.is_active).length) },
              ]}
            />
            {error ? <Banner tone="recover" text={error} /> : null}
            {categories.length === 0 && !q ? <Empty text={t.expense.categoriesEmpty} /> : null}
            {q && items.length === 0 ? <Empty text={t.list.noMatch} /> : null}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === 'title') return <SectionTitle title={t.expense.hidden} />;
          const c = item.category;
          if (!c.is_active) {
            return (
              <ListRow label={expenseCategoryLabel(c.name)} muted divider={item.divider}>
                <IconAction icon="eye-outline" label={t.expense.show} onPress={() => setExpenseCategoryActive(c.id, true)} />
              </ListRow>
            );
          }
          if (c.id === editingId) {
            return (
              <CategoryEditRow
                category={c}
                divider={item.divider}
                onSave={(draft) => rename(c, draft)}
                onCancel={() => {
                  setError(null);
                  setEditingId(null);
                }}
              />
            );
          }
          return (
            <ListRow label={expenseCategoryLabel(c.name)} divider={item.divider}>
              <IconAction icon="pencil-outline" label={t.action.edit} onPress={() => setEditingId(c.id)} />
              <IconAction icon="eye-off-outline" label={t.expense.hide} tone="danger" onPress={() => setHiding(c)} />
            </ListRow>
          );
        }}
      />

      <ChoiceDialog
        open={hiding !== null}
        onClose={() => setHiding(null)}
        title={hiding ? `${expenseCategoryLabel(hiding.name)} — ${t.expense.hide}?` : ''}
        description={t.expense.hideHelp}
        actions={[
          { label: t.expense.hide, tone: 'danger', onPress: () => hiding && setExpenseCategoryActive(hiding.id, false) },
        ]}
        cancelLabel={t.action.cancel}
      />
    </ListScreen>
  );
}

/** The rename box, holding its draft so typing re-renders only this row. */
function CategoryEditRow({
  category,
  divider,
  onSave,
  onCancel,
}: {
  category: ExpenseCategory;
  divider: boolean;
  onSave: (draft: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(category.name);
  return (
    <EditRow
      divider={divider}
      value={draft}
      onChangeText={setDraft}
      onSave={() => onSave(draft)}
      onCancel={onCancel}
      saveLabel={t.trades.save}
      cancelLabel={t.action.cancel}
    />
  );
}
