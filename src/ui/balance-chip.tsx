import { StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import type { Strings } from '@/strings.en';

import { Money, T } from './text';
import { colors, space } from './theme';

/** Balance from the business's point of view, always labelled in words — never a bare minus sign. */
export function balanceLabel(paisa: number, s: Strings = t) {
  if (paisa > 0) return { label: s.balance.owedToWorker, fg: colors.owed, bg: colors.owedSoft };
  if (paisa < 0) return { label: s.balance.owedByWorker, fg: colors.recover, bg: colors.recoverSoft };
  return { label: s.balance.settled, fg: colors.muted, bg: colors.bg };
}

export function BalanceChip({ paisa, size = 16 }: { paisa: number; size?: number }) {
  const { label, fg, bg } = balanceLabel(paisa);
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <T variant="bodyBold" style={{ color: fg, fontSize: size * 0.85 }}>
        {label}
      </T>
      {paisa !== 0 ? <Money paisa={paisa} size={size} color={fg} /> : null}
    </View>
  );
}

/**
 * A project's two totals side by side — owed to workers, recoverable from workers — each
 * in its own colour, instead of one netted figure.
 */
export function BalanceSplit({ owed, recoverable, size = 16 }: { owed: number; recoverable: number; size?: number }) {
  return (
    <View style={styles.split}>
      <SplitSide label={t.balance.owedToWorker} paisa={owed} fg={colors.owed} bg={colors.owedSoft} size={size} />
      <SplitSide label={t.balance.owedByWorker} paisa={recoverable} fg={colors.recover} bg={colors.recoverSoft} size={size} />
    </View>
  );
}

function SplitSide({ label, paisa, fg, bg, size }: { label: string; paisa: number; fg: string; bg: string; size: number }) {
  // Nothing on this side: a quiet zero, so the other side stands out.
  const color = paisa > 0 ? fg : colors.muted;
  return (
    <View style={[styles.side, { backgroundColor: paisa > 0 ? bg : colors.bg }]}>
      <T variant="small" style={{ color, alignSelf: 'stretch' }}>
        {label}
      </T>
      <Money paisa={paisa} size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  split: { flexDirection: 'row', gap: space.sm, alignSelf: 'stretch' },
  side: { flex: 1, borderRadius: 12, paddingHorizontal: space.md, paddingVertical: space.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
});
