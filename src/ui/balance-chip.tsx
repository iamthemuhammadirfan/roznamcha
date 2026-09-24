import { StyleSheet, View } from 'react-native';

import { ur } from '@/strings.ur';

import { Money, T } from './text';
import { colors, space } from './theme';

/** Balance from the business's point of view, always labelled in words — never a bare minus sign. */
export function balanceLabel(paisa: number) {
  if (paisa > 0) return { label: ur.balance.owedToWorker, fg: colors.owed, bg: colors.owedSoft };
  if (paisa < 0) return { label: ur.balance.owedByWorker, fg: colors.recover, bg: colors.recoverSoft };
  return { label: ur.balance.settled, fg: colors.muted, bg: colors.bg };
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

const styles = StyleSheet.create({
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
