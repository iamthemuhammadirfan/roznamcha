import {
  type CommonPowerSyncDatabase,
  type CrudEntry,
  type PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import { randomUUID } from 'expo-crypto';

import { powersyncUrl, supabase } from '@/lib/supabase';

import { BOOLEAN_COLUMNS } from './schema';

// Postgres error classes that will never succeed on retry: data exceptions (22),
// integrity violations (23) and insufficient privilege / RLS (42501). Everything else
// — network, 5xx — throws so PowerSync retries later.
const FATAL = [/^22...$/, /^23...$/, /^42501$/];

function toPostgres(data: Record<string, unknown> | undefined) {
  const out: Record<string, unknown> = { ...data };
  for (const key of Object.keys(out)) {
    if (BOOLEAN_COLUMNS.has(key) && out[key] != null) out[key] = Boolean(out[key]);
  }
  return out;
}

async function uploadOne(op: CrudEntry) {
  const table = supabase!.from(op.table);
  const data = toPostgres(op.opData);
  switch (op.op) {
    case UpdateType.PUT: {
      const row = { ...data, id: op.id };
      if (op.table === 'attendance') {
        // Two phones can mark the same worker on the same day; the later write wins and
        // the audit trigger keeps the earlier value.
        return table.upsert(row, { onConflict: 'assignment_id,date' });
      }
      // Every other PUT is a row created on this phone. ON CONFLICT DO NOTHING keeps a
      // retried upload idempotent and needs no UPDATE privilege (the ledger has none).
      return table.upsert(row, { onConflict: 'id', ignoreDuplicates: true });
    }
    case UpdateType.PATCH: {
      // RLS filters an update it doesn't allow down to zero rows instead of raising, so
      // ask for the row back and treat "nothing updated" as a rejection.
      const result = await table.update(data).eq('id', op.id).select('id');
      if (!result.error && result.data?.length === 0) {
        return { error: { code: '42501', message: 'update not permitted' } };
      }
      return result;
    }
    case UpdateType.DELETE:
      return table.delete().eq('id', op.id);
  }
}

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials() {
    const { data, error } = await supabase!.auth.getSession();
    if (error) throw error;
    if (!data.session) return null;
    return { endpoint: powersyncUrl!, token: data.session.access_token };
  }

  async uploadData(database: CommonPowerSyncDatabase) {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    for (const op of transaction.crud) {
      const result = await uploadOne(op);
      const error = result?.error;
      if (!error) continue;

      if (error.code && FATAL.some((re) => re.test(error.code))) {
        await database.execute(
          'INSERT INTO rejected_write (id, table_name, op, data, error, rejected_at) VALUES (?, ?, ?, ?, ?, ?)',
          [randomUUID(), op.table, op.op, JSON.stringify({ id: op.id, ...op.opData }), error.message, new Date().toISOString()],
        );
        continue;
      }
      throw error;
    }
    await transaction.complete();
  }
}
