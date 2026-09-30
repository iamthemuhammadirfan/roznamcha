import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { useWorker, useWorkers } from '@/db/hooks';
import { createWorker, updateWorker } from '@/db/mutations';
import type { Worker } from '@/db/schema';
import { normalizePhone } from '@/lib/money';
import { useMember, useWriteContext } from '@/state/session';
import { t, tradeLabel, tradeOptions } from '@/i18n';
import { Banner, Button, Choice, Field, Screen } from '@/ui/controls';
import { T } from '@/ui/text';

const norm = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Aggressive duplicate check: same phone, or same name + father's name. */
function findDuplicate(workers: Worker[], name: string, father: string, phone: string, exceptId?: string) {
  const others = workers.filter((w) => w.id !== exceptId);
  const p = phone ? normalizePhone(phone) : '';
  if (p.length >= 10) {
    const byPhone = others.find((w) => w.phone && normalizePhone(w.phone) === p);
    if (byPhone) return { worker: byPhone, reason: t.worker.duplicatePhone };
  }
  const byName = others.find((w) => norm(w.name_ur) === norm(name) && norm(w.father_name) === norm(father));
  if (byName) return { worker: byName, reason: t.worker.duplicateName };
  return null;
}

type Params = { id?: string; assign?: string; name?: string };

export default function WorkerFormScreen() {
  const params = useLocalSearchParams<Params>();
  const existing = useWorker(params.id ?? '');
  if (params.id && !existing) return null;
  return <WorkerForm key={existing?.id ?? 'new'} params={params} existing={existing} />;
}

function WorkerForm({ params, existing }: { params: Params; existing: Worker | null }) {
  const workers = useWorkers();
  const ctx = useWriteContext();
  const { role } = useMember();

  const prefill = params.name ?? '';
  const prefillIsPhone = /^[\d\s+-]{3,}$/.test(prefill);
  const [name, setName] = useState(existing?.name_ur ?? (prefillIsPhone ? '' : prefill));
  const [father, setFather] = useState(existing?.father_name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? (prefillIsPhone ? prefill : ''));
  const [cnic, setCnic] = useState(existing?.cnic_last4 ?? '');
  const [trade, setTrade] = useState<string>(existing?.trade ?? tradeOptions[1]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const readOnly = Boolean(params.id) && role !== 'owner';
  const input = { name_ur: name, father_name: father, phone, cnic_last4: cnic, trade };

  function afterCreate(workerId: string) {
    if (params.assign === '1') router.replace({ pathname: '/assign', params: { workerId } });
    else router.replace({ pathname: '/worker/[id]', params: { id: workerId } });
  }

  async function commit() {
    setBusy(true);
    if (params.id) {
      await updateWorker(params.id, input);
      router.back();
    } else {
      afterCreate(await createWorker(ctx, input));
    }
  }

  function save() {
    if (!name.trim()) return setError(t.worker.nameRequired);
    if (cnic && !/^\d{4}$/.test(cnic)) return setError(t.worker.cnicLast4);
    const dup = findDuplicate(workers, name, father, phone, params.id);
    if (!dup) return commit();

    const who = `${dup.worker.name_ur}${dup.worker.father_name ? ` ${t.worker.son} ${dup.worker.father_name}` : ''}\n${dup.worker.phone ?? ''}`;
    Alert.alert(t.worker.duplicateQuestion, `${dup.reason}\n${who}`, [
      ...(params.id
        ? []
        : [{ text: t.worker.useExisting, onPress: () => afterCreate(dup.worker.id) }]),
      { text: t.worker.createAnyway, style: 'destructive' as const, onPress: commit },
      { text: t.action.cancel, style: 'cancel' as const },
    ]);
  }

  return (
    <Screen>
      {error ? <Banner tone="recover" text={error} /> : null}
      <Field label={t.worker.name} value={name} onChangeText={setName} editable={!readOnly} />
      <Field label={t.worker.fatherName} value={father} onChangeText={setFather} editable={!readOnly} />
      <Field label={t.worker.phone} value={phone} onChangeText={setPhone} numeric keyboardType="phone-pad" editable={!readOnly} />
      <Field
        label={t.worker.cnicLast4}
        value={cnic}
        onChangeText={(v) => setCnic(v.replace(/\D/g, '').slice(0, 4))}
        numeric
        maxLength={4}
        editable={!readOnly}
      />
      <T variant="bodyBold">{t.worker.trade}</T>
      <Choice
        options={tradeOptions.map((v) => ({ value: v, label: tradeLabel(v) }))}
        value={trade}
        onChange={(v) => !readOnly && setTrade(v)}
      />
      {!readOnly ? <Button label={t.action.save} onPress={save} busy={busy} /> : null}
    </Screen>
  );
}
