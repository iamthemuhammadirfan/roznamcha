import type { Ref } from 'react';
import { StyleSheet, View } from 'react-native';

import { entryKindLabel } from '@/i18n';
import { formatDayUr, weekdayUr } from '@/lib/dates';
import { ur } from '@/strings.ur';

import { balanceLabel } from './balance-chip';
import { Money, Num, T } from './text';
import { colors, fonts, space } from './theme';

export interface ParchiData {
  businessName: string;
  workerName: string;
  fatherName: string | null;
  projectCode: string;
  projectName: string;
  date: string;
  kind: string;
  amountPaisa: number;
  note: string | null;
  balancePaisa: number;
  refCode: string;
}

/**
 * The receipt, in the spec's order and nothing more: business, worker, date, amount,
 * reason, new balance in words, reference code. Captured to PNG with view-shot, so it
 * must render the same every time — fixed width, no dynamic layout.
 *
 * Always Urdu and always right-to-left, even when the app is in English: the worker
 * reads it, not the person holding the phone.
 */
export function Parchi({ data, ref }: { data: ParchiData; ref?: Ref<View> }) {
  const bal = balanceLabel(data.balancePaisa, ur);
  return (
    <View ref={ref} collapsable={false} style={styles.slip}>
      <View style={styles.header}>
        <T script="ur" style={styles.appName}>{ur.app.name}</T>
        <T script="ur" variant="h2" style={styles.business}>
          {data.businessName}
        </T>
      </View>

      <View style={styles.body}>
        <T script="ur" style={styles.worker}>{data.workerName}</T>
        {data.fatherName ? (
          <T script="ur" variant="small">
            {ur.worker.son} {data.fatherName}
          </T>
        ) : null}

        <View style={styles.metaRow}>
          <T script="ur" variant="body">
            {weekdayUr(data.date)} {formatDayUr(data.date)}
          </T>
        </View>
        <View style={styles.metaRow}>
          <T script="ur" variant="small">{ur.receipt.project}</T>
          <Num script="ur" bold>{data.projectCode}</Num>
          <T script="ur" variant="small">{data.projectName}</T>
        </View>

        <View style={styles.amountBox}>
          <T script="ur" variant="h2">{entryKindLabel(data.kind, ur)}</T>
          <Money script="ur" paisa={data.amountPaisa} size={40} />
          {data.note ? <T script="ur" variant="small">{data.note}</T> : null}
        </View>

        <View style={[styles.balanceBox, { backgroundColor: bal.bg }]}>
          <T script="ur" variant="small">{ur.balance.newBalance}</T>
          <T script="ur" variant="h2" style={{ color: bal.fg }}>
            {bal.label}
          </T>
          {data.balancePaisa !== 0 ? <Money script="ur" paisa={data.balancePaisa} size={26} color={bal.fg} /> : null}
        </View>

        <View style={styles.metaRow}>
          <T script="ur" variant="small">{ur.receipt.ref}</T>
          <Num script="ur" bold style={styles.ref}>
            {data.refCode}
          </Num>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slip: { width: 360, direction: 'rtl', backgroundColor: colors.white, borderRadius: 12, overflow: 'hidden' },
  header: { backgroundColor: colors.brand, alignItems: 'center', paddingTop: space.sm, paddingBottom: space.md },
  appName: { fontFamily: fonts.urdu, fontSize: 32, lineHeight: 70, color: colors.white },
  business: { color: colors.white },
  body: { padding: space.lg, gap: space.sm, alignItems: 'center' },
  worker: { fontFamily: fonts.urdu, fontSize: 32, lineHeight: 66 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  amountBox: {
    alignSelf: 'stretch',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: space.md,
    marginVertical: space.sm,
  },
  balanceBox: { alignSelf: 'stretch', alignItems: 'center', borderRadius: 10, paddingVertical: space.md },
  ref: { fontSize: 18, letterSpacing: 1 },
});
