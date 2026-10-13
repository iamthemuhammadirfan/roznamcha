import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as Updates from 'expo-updates';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useRejectedWrites } from '@/db/hooks';
import { dismissRejected } from '@/db/mutations';
import type { rejectedWrite } from '@/db/schema';
import { formatDay } from '@/lib/dates';
import { lang, t } from '@/i18n';

import { Button, Card, Row } from './controls';
import { Money, Num, T } from './text';
import { colors, space } from './theme';

/** "New version ready — restart", shown once an OTA update has downloaded. */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  if (!isUpdatePending) return null;
  return (
    <Card style={{ backgroundColor: colors.brandSoft }}>
      <T variant="bodyBold">{t.settings.updateReady}</T>
      <Button label={t.settings.restart} onPress={() => Updates.reloadAsync()} />
    </Card>
  );
}

type Rejected = typeof rejectedWrite.$inferSelect;
type Reason = 'duplicate' | 'permission' | 'invalid' | 'other';

/** The server's Postgres message, turned into something the munshi can act on. */
function reasonOf(error: string | null): Reason {
  const e = (error ?? '').toLowerCase();
  if (e.includes('duplicate key')) return 'duplicate';
  if (e.includes('row-level security') || e.includes('not permitted') || e.includes('permission')) return 'permission';
  if (e.includes('violates') || e.includes('invalid input')) return 'invalid';
  return 'other';
}

const REASON_TEXT: Record<Reason, string> = {
  duplicate: t.dashboard.reasonDuplicate,
  permission: t.dashboard.reasonPermission,
  invalid: t.dashboard.reasonInvalid,
  other: t.dashboard.reasonOther,
};

function recordLabel(table: string): string {
  return (t.record as Record<string, string>)[table] ?? table;
}

/** The few fields that tell a person which entry this was. */
function summaryOf(r: Rejected): { name?: string; paisa?: number; day?: string } {
  try {
    const d = JSON.parse(r.data ?? '{}') as Record<string, unknown>;
    const name = (d.name ?? d.name_ur ?? d.code) as string | undefined;
    const paisa = typeof d.amount_paisa === 'number' ? d.amount_paisa : undefined;
    const day = typeof d.date === 'string' ? d.date : undefined;
    return { name, paisa, day };
  } catch {
    return {};
  }
}

/**
 * Uploads the server rejected (RLS, constraints) — never dropped silently, but never a
 * wall of Postgres either: a slim strip on Home, and a sheet that says in plain words
 * what each entry was and why it didn't save.
 */
export function NotSaved() {
  const rejected = useRejectedWrites();
  const [open, setOpen] = useState(false);
  if (rejected.length === 0) return null;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.strip, pressed && { opacity: 0.85 }]}>
        <MaterialCommunityIcons name="alert-circle-outline" size={26} color={colors.recover} />
        <View style={{ flex: 1 }}>
          <Row style={{ gap: space.xs }}>
            <Num bold style={{ color: colors.recover }}>
              {rejected.length}
            </Num>
            <T variant="bodyBold" style={{ flex: 1, color: colors.recover }}>
              {t.dashboard.notSaved}
            </T>
          </Row>
          <T variant="small">{t.dashboard.rejectedTap}</T>
        </View>
        <MaterialCommunityIcons name={lang === 'ur' ? 'chevron-left' : 'chevron-right'} size={24} color={colors.recover} />
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} accessibilityLabel={t.action.cancel} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <Row>
            <MaterialCommunityIcons name="alert-circle-outline" size={26} color={colors.recover} />
            <T variant="h2" style={{ flex: 1 }}>
              {t.dashboard.rejectedTitle}
            </T>
          </Row>
          <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={{ gap: space.md }}>
            {rejected.map((r) => (
              <RejectedItem key={r.id} r={r} />
            ))}
          </ScrollView>
          {rejected.length > 1 ? (
            <Button
              label={t.dashboard.rejectedAll}
              kind="secondary"
              onPress={async () => {
                for (const r of rejected) await dismissRejected(r.id);
                setOpen(false);
              }}
            />
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}

function RejectedItem({ r }: { r: Rejected }) {
  const reason = reasonOf(r.error);
  const s = summaryOf(r);
  return (
    <View style={styles.item}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <T variant="bodyBold">
            {recordLabel(r.table_name)}
            {s.name ? `: ${s.name}` : ''}
          </T>
          {s.paisa !== undefined || s.day ? (
            <Row>
              {s.paisa !== undefined ? <Money paisa={s.paisa} size={15} /> : null}
              {s.day ? <T variant="small">{formatDay(s.day, lang)}</T> : null}
            </Row>
          ) : null}
        </View>
        <Num style={styles.when}>{formatDay(r.rejected_at.slice(0, 10), lang)}</Num>
      </Row>
      <T style={{ color: reason === 'duplicate' ? colors.text : colors.recover }}>{REASON_TEXT[reason]}</T>
      {/* For whoever is debugging; deliberately small and untranslated. */}
      <Num style={styles.tech} numberOfLines={2}>
        {r.op} · {r.error}
      </Num>
      <Button label={t.dashboard.rejectedOk} onPress={() => dismissRejected(r.id)} />
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 14,
    backgroundColor: colors.recoverSoft,
    borderStartWidth: 4,
    borderStartColor: colors.recover,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    marginBottom: space.xs,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    maxHeight: '80%',
    backgroundColor: colors.card,
    borderTopStartRadius: 20,
    borderTopEndRadius: 20,
    padding: space.lg,
    gap: space.md,
  },
  item: {
    gap: space.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
  },
  when: { fontSize: 13, color: colors.muted },
  tech: { fontSize: 11, lineHeight: 16, color: colors.muted },
});
