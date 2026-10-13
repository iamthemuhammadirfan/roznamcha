import { useState } from 'react';
import { Alert } from 'react-native';

import { useTrades, useWorkers } from '@/db/hooks';
import { addTrade, removeTrade, renameTrade } from '@/db/mutations';
import type { Trade } from '@/db/schema';
import { t, tradeLabel } from '@/i18n';
import { useMember, useWriteContext } from '@/state/session';
import { AddBar } from '@/ui/add-bar';
import { Banner, Empty, Row, Screen } from '@/ui/controls';
import { EditRow, IconAction, ListGroup, ListRow } from '@/ui/list-group';
import { Num, T } from '@/ui/text';
import { colors, space } from '@/ui/theme';

const fold = (s: string) => s.trim().toLowerCase();

/**
 * Owner's list of trades. The box at the bottom both searches and adds: typing filters
 * the list, and an exact match disables the plus — so an existing trade is seen before
 * it's typed in twice.
 */
export default function TradesScreen() {
  const trades = useTrades();
  const workers = useWorkers();
  const ctx = useWriteContext();
  const { role } = useMember();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (role !== 'owner') {
    return (
      <Screen>
        <Banner text={t.trades.ownerOnly} />
      </Screen>
    );
  }

  const counts = new Map<string, number>();
  for (const w of workers) if (w.trade) counts.set(w.trade, (counts.get(w.trade) ?? 0) + 1);
  // Trades workers already carry that the list doesn't have: typed before this list
  // existed, or removed from it later. One tap puts them back.
  const listed = new Set(trades.map((r) => r.name));
  const unlisted = [...counts.keys()].filter((n) => !listed.has(n));

  const q = fold(name);
  // Matches the stored name or how it's shown, so "Mason" finds مستری in English.
  const hit = (stored: string) => !q || fold(stored).includes(q) || fold(tradeLabel(stored)).includes(q);
  const shown = trades.filter((r) => hit(r.name));
  const shownUnlisted = unlisted.filter(hit);
  const exists = Boolean(q) && trades.some((r) => fold(r.name) === q || fold(tradeLabel(r.name)) === q);

  async function add(value: string) {
    if (!value.trim()) return false;
    const ok = await addTrade(ctx, value);
    setError(ok ? null : t.trades.duplicate);
    return ok;
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
          onAdd={async () => (await add(name)) && setName('')}
        />
      }>
      {error ? <Banner tone="recover" text={error} /> : null}

      {trades.length === 0 && !q ? <Empty text={t.trades.empty} /> : null}
      {q && shown.length === 0 && shownUnlisted.length === 0 ? <Empty text={t.list.noMatch} /> : null}

      <ListGroup>
        {shown.map((r) => (
          <TradeRow key={r.id} trade={r} workerCount={counts.get(r.name) ?? 0} onError={setError} />
        ))}
      </ListGroup>

      <ListGroup title={shownUnlisted.length ? t.trades.unlisted : undefined}>
        {shownUnlisted.map((n) => (
          <ListRow key={n} label={tradeLabel(n)} muted detail={<Count n={counts.get(n) ?? 0} />}>
            <IconAction icon="plus" label={t.trades.add} onPress={() => add(n)} />
          </ListRow>
        ))}
      </ListGroup>
    </Screen>
  );
}

function Count({ n }: { n: number }) {
  if (n === 0) return null;
  return (
    <Row style={{ gap: space.xs }}>
      <Num style={{ color: colors.muted }}>{n}</Num>
      <T variant="small">{t.trades.workers}</T>
    </Row>
  );
}

function TradeRow({
  trade,
  workerCount,
  onError,
}: {
  trade: Trade;
  workerCount: number;
  onError: (e: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(trade.name);

  async function save() {
    if (await renameTrade(trade.id, draft)) {
      onError(null);
      setEditing(false);
    } else {
      onError(t.trades.duplicate);
    }
  }

  function cancel() {
    setDraft(trade.name);
    onError(null);
    setEditing(false);
  }

  function confirmRemove() {
    const help = workerCount > 0 ? t.trades.removeHelp : '';
    Alert.alert(`${tradeLabel(trade.name)} — ${t.trades.removeConfirm}`, help, [
      { text: t.action.cancel, style: 'cancel' },
      { text: t.trades.remove, style: 'destructive', onPress: () => removeTrade(trade.id) },
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
    <ListRow label={tradeLabel(trade.name)} detail={<Count n={workerCount} />}>
      <IconAction icon="pencil-outline" label={t.action.edit} onPress={() => setEditing(true)} />
      <IconAction icon="trash-can-outline" label={t.trades.remove} tone="danger" onPress={confirmRemove} />
    </ListRow>
  );
}
