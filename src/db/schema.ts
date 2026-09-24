// Local mirror of the Postgres tables in supabase/migrations. PowerSync stores rows as
// JSON behind SQLite views, so unique indexes and foreign keys are NOT enforced on the
// phone — the app code enforces them (see queries.ts) and Postgres enforces them again.
import { DrizzleAppSchema } from '@powersync/drizzle-driver';
import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const id = () => text('id').primaryKey().notNull();
const owned = () => ({
  business_id: text('business_id').notNull(),
  created_by: text('created_by'),
  created_at: text('created_at'),
  updated_at: text('updated_at'),
});

export const business = sqliteTable('business', {
  id: id(),
  name: text('name').notNull(),
});

export const membership = sqliteTable('membership', {
  id: id(),
  business_id: text('business_id').notNull(),
  user_id: text('user_id').notNull(),
  role: text('role').notNull(),
});

export const project = sqliteTable('project', {
  id: id(),
  code: text('code').notNull(),
  name_ur: text('name_ur').notNull(),
  address: text('address'),
  started_on: text('started_on'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull(),
  ...owned(),
});

export const worker = sqliteTable('worker', {
  id: id(),
  name_ur: text('name_ur').notNull(),
  father_name: text('father_name'),
  phone: text('phone'),
  cnic_last4: text('cnic_last4'),
  trade: text('trade'),
  photo_uri: text('photo_uri'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull(),
  ...owned(),
});

export const assignment = sqliteTable('assignment', {
  id: id(),
  worker_id: text('worker_id').notNull(),
  project_id: text('project_id').notNull(),
  daily_rate_paisa: integer('daily_rate_paisa').notNull(),
  started_on: text('started_on').notNull(),
  ended_on: text('ended_on'),
  is_active: integer('is_active', { mode: 'boolean' }).notNull(),
  ...owned(),
});

export const attendance = sqliteTable('attendance', {
  id: id(),
  assignment_id: text('assignment_id').notNull(),
  date: text('date').notNull(),
  status: text('status').notNull(),
  overtime_hours: real('overtime_hours').notNull(),
  rate_applied_paisa: integer('rate_applied_paisa').notNull(),
  marked_at: text('marked_at'),
  ...owned(),
});

export const ledgerEntry = sqliteTable('ledger_entry', {
  id: id(),
  assignment_id: text('assignment_id').notNull(),
  date: text('date').notNull(),
  kind: text('kind').notNull(),
  amount_paisa: integer('amount_paisa').notNull(),
  note_ur: text('note_ur'),
  ref_code: text('ref_code').notNull(),
  reverses_id: text('reverses_id'),
  receipt_sent_at: text('receipt_sent_at'),
  ...owned(),
});

export const settlement = sqliteTable('settlement', {
  id: id(),
  assignment_id: text('assignment_id').notNull(),
  period_start: text('period_start').notNull(),
  period_end: text('period_end').notNull(),
  wages_earned_paisa: integer('wages_earned_paisa').notNull(),
  advances_paisa: integer('advances_paisa').notNull(),
  paid_paisa: integer('paid_paisa').notNull(),
  carried_forward_paisa: integer('carried_forward_paisa').notNull(),
  settled_at: text('settled_at'),
  ...owned(),
});

export const appConfig = sqliteTable('app_config', {
  id: id(),
  min_supported_version: text('min_supported_version'),
  latest_apk_url: text('latest_apk_url'),
});

// Local only: uploads the server rejected (RLS, constraint). Shown as "not saved" on
// the dashboard instead of being silently dropped.
export const rejectedWrite = sqliteTable('rejected_write', {
  id: id(),
  table_name: text('table_name').notNull(),
  op: text('op').notNull(),
  data: text('data'),
  error: text('error'),
  rejected_at: text('rejected_at').notNull(),
});

export const drizzleSchema = {
  business,
  membership,
  project,
  worker,
  assignment,
  attendance,
  ledger_entry: ledgerEntry,
  settlement,
  app_config: appConfig,
  rejected_write: rejectedWrite,
};

export const AppSchema = new DrizzleAppSchema({
  business,
  membership,
  project,
  worker,
  assignment,
  attendance,
  ledger_entry: ledgerEntry,
  settlement,
  app_config: appConfig,
  rejected_write: { tableDefinition: rejectedWrite, options: { localOnly: true } },
});

export type Project = typeof project.$inferSelect;
export type Worker = typeof worker.$inferSelect;
export type Assignment = typeof assignment.$inferSelect;
export type Attendance = typeof attendance.$inferSelect;
export type LedgerEntry = typeof ledgerEntry.$inferSelect;

/** Columns that are boolean in Postgres but 0/1 in SQLite; the connector converts them on upload. */
export const BOOLEAN_COLUMNS = new Set(['is_active']);
