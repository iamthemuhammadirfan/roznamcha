import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import type { DayStatus } from '@/lib/attendance';

import { Row } from './controls';
import type { IconName } from './settings-list';
import { Num, T } from './text';
import { colors } from './theme';

export const STATUS_STYLE: Record<DayStatus, { fg: string; bg: string }> = {
  full: { fg: colors.owed, bg: colors.owedSoft },
  half: { fg: colors.pending, bg: colors.pendingSoft },
  absent: { fg: colors.recover, bg: colors.recoverSoft },
};

export function statusLabel(s: DayStatus): string {
  return t.attendance[s];
}

/** "12 پورا دن" — a count beside its label, coloured by status. */
export function StatusCount({ status, n }: { status: DayStatus; n: number }) {
  const { fg } = STATUS_STYLE[status];
  return (
    <Row>
      <Num bold style={{ fontSize: 20, color: fg }}>
        {n}
      </Num>
      <T variant="small" style={{ color: fg }}>
        {statusLabel(status)}
      </T>
    </Row>
  );
}

export const STATUS_ICON: Record<DayStatus, IconName> = {
  full: 'check-bold',
  half: 'fraction-one-half',
  absent: 'close-thick',
};

const ORDER: DayStatus[] = ['full', 'half', 'absent'];

/**
 * Three round buttons — ✓ full, ½ half, ✗ absent — so one tap sets the exact status.
 * Icons, not words: they read the same in Urdu and English and need no schooling.
 */
export function StatusPicker({
  value,
  onChange,
  disabled,
}: {
  value: DayStatus;
  onChange: (s: DayStatus) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.picker}>
      {ORDER.map((s) => {
        const selected = s === value;
        const { fg, bg } = STATUS_STYLE[s];
        return (
          <Pressable
            key={s}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={statusLabel(s)}
            disabled={disabled}
            onPress={() => onChange(s)}
            hitSlop={4}
            style={[
              styles.dot,
              selected ? { backgroundColor: fg, borderColor: fg } : { backgroundColor: bg, borderColor: bg },
            ]}>
            <MaterialCommunityIcons name={STATUS_ICON[s]} size={26} color={selected ? colors.white : fg} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { flexDirection: 'row', gap: 6 },
  dot: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
