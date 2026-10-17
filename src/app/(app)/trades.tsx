import { useDeferredValue, useState } from 'react';
import { FlatList } from 'react-native';

import { useTrades, useTradeWorkerCounts } from '@/db/hooks';
import { addTrade, removeTrade, renameTrade } from '@/db/mutations';
import type { Trade } from '@/db/schema';
import { t, tradeLabel } from '@/i18n';
import { useMember, useWriteContext } from '@/state/session';
import { AddBar } from '@/ui/add-bar';
import { ChoiceDialog } from '@/ui/choice-dialog';
import { Empty } from '@/ui/controls';
import { EditRow, IconAction, ListRow, SectionTitle } from '@/ui/list-group';
import { ListBanner, ListScreen } from '@/ui/list-screen';
import { ListStage, useSweep } from '@/ui/site-status';

const fold = (s: string) => s.trim().toLowerCase();

type Item =
  | { kind: 'trade'; key: string; trade: Trade; n: number; divider: boolean }
  | { kind: 'title'; key: string }
  | { kind: 'unlisted'; key: string; name: string; n: number; divider: boolean };

/**
 * Owner's list of trades. The box at the bottom both searches and adds: typing filters
 * the list, and an exact match disables the plus — so an existing trade is seen before
 * it's typed in twice. Each trade shows how many workers have it, as a count and a meter.
 */
export default function TradesScreen() {
  const trades = useTrades();
  const counts = useTradeWorkerCounts();
  const ctx = useWriteContext();
  const { role } = useMember();
  const sweep = useSweep();
  const [name, setName] = useState('');
  // The list filters on a deferred copy, so typing never waits for it.
  const query = useDeferredValue(name);
  const [error, setError] = useState<string | null>(null);
  // One row is renamed at a time, and one dialog serves every row.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [removing, setRemoving] = useState<Trade | null>(null);

  if (role !== 'owner') {
    return (
      <ListScreen>
        <ListBanner text={t.trades.ownerOnly} />
      </ListScreen>
    );
  }

  // Trades workers already carry that the list doesn't have: typed before this list
  // existed, or removed from it later. One tap puts them back.
  const listed = new Set(trades.map((r) => r.name));
  const unlisted = [...counts.keys()].filter((n) => !listed.has(n));
  const max = Math.max(0, ...counts.values());
  const workers = [...counts.values()].reduce((a, b) => a + b, 0);

  const q = fold(query);
  // Matches the stored name or how it's shown, so "Mason" finds مستری in English.
  const hit = (stored: string) => !q || fold(stored).includes(q) || fold(tradeLabel(stored)).includes(q);
  const shown = trades.filter((r) => hit(r.name));
  const shownUnlisted = unlisted.filter(hit);
  const typed = fold(name);
  const exists = Boolean(typed) && trades.some((r) => fold(r.name) === typed || fold(tradeLabel(r.name)) === typed);

  const items: Item[] = [
    ...shown.map((r, i) => ({ kind: 'trade' as const, key: r.id, trade: r, n: counts.get(r.name) ?? 0, divider: i > 0 })),
    ...(shownUnlisted.length ? [{ kind: 'title' as const, key: 'unlisted-title' }] : []),
    ...shownUnlisted.map((n, i) => ({ kind: 'unlisted' as const, key: `u:${n}`, name: n, n: counts.get(n) ?? 0, divider: i > 0 })),
  ];

  async function add(value: string) {
    if (!value.trim()) return false;
    const ok = await addTrade(ctx, value);
    setError(ok ? null : t.trades.duplicate);
    return ok;
  }

  async function rename(trade: Trade, draft: string) {
    if (await renameTrade(trade.id, draft)) {
      setError(null);
      setEditingId(null);
    } else {
      setError(t.trades.duplicate);
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
          onAdd={async () => (await add(name)) && setName('')}
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
                { label: t.list.inList, value: String(trades.length) },
                { label: t.trades.workers, value: String(workers) },
              ]}
            />
            {error ? <ListBanner tone="recover" text={error} /> : null}
            {trades.length === 0 && !q ? <Empty text={t.trades.empty} /> : null}
            {q && items.length === 0 ? <Empty text={t.list.noMatch} /> : null}
          </>
        }
        renderItem={({ item }) => {
          if (item.kind === 'title') return <SectionTitle title={t.trades.unlisted} />;
          const count = { n: item.n, max, unit: t.trades.workers, sweep };
          if (item.kind === 'unlisted') {
            return (
              <ListRow label={tradeLabel(item.name)} muted count={count} divider={item.divider}>
                <IconAction icon="plus" label={t.trades.add} onPress={() => add(item.name)} />
              </ListRow>
            );
          }
          if (item.trade.id === editingId) {
            return (
              <TradeEditRow
                trade={item.trade}
                divider={item.divider}
                onSave={(draft) => rename(item.trade, draft)}
                onCancel={() => {
                  setError(null);
                  setEditingId(null);
                }}
              />
            );
          }
          return (
            <ListRow label={tradeLabel(item.trade.name)} count={count} divider={item.divider}>
              <IconAction icon="pencil-outline" label={t.action.edit} onPress={() => setEditingId(item.trade.id)} />
              <IconAction
                icon="trash-can-outline"
                label={t.trades.remove}
                tone="danger"
                onPress={() => setRemoving(item.trade)}
              />
            </ListRow>
          );
        }}
      />

      <ChoiceDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `${tradeLabel(removing.name)} — ${t.trades.removeConfirm}` : ''}
        description={removing && (counts.get(removing.name) ?? 0) > 0 ? t.trades.removeHelp : undefined}
        actions={[{ label: t.trades.remove, tone: 'danger', onPress: () => removing && removeTrade(removing.id) }]}
        cancelLabel={t.action.cancel}
      />
    </ListScreen>
  );
}

/** The rename box, holding its draft so typing re-renders only this row. */
function TradeEditRow({
  trade,
  divider,
  onSave,
  onCancel,
}: {
  trade: Trade;
  divider: boolean;
  onSave: (draft: string) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(trade.name);
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
