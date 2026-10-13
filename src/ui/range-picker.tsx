// Pick a from–to range on a month calendar: tap the first day, then the last. Built on
// MonthGrid rather than a native date picker so it ships over the air and reads in Urdu.
import { useState } from 'react';
import { Modal, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { DayRange } from '@/lib/expenses';
import { formatDay, today } from '@/lib/dates';
import { isUrdu, lang, t } from '@/i18n';

import { Button, Row } from './controls';
import { MonthGrid, MonthNav, monthOf } from './month-grid';
import { Num, T } from './text';
import { colors, space } from './theme';

/** "1 اکتوبر 2026 سے 13 اکتوبر 2026 تک" / "from 1 October 2026 to 13 October 2026". */
export function rangeLabel(r: DayRange): string {
  if (r.from === r.to) return formatDay(r.from, lang);
  return isUrdu
    ? `${formatDay(r.from, lang)} ${t.expense.rangeFrom} ${formatDay(r.to, lang)} ${t.expense.rangeTo}`
    : `${t.expense.rangeFrom} ${formatDay(r.from, lang)} ${t.expense.rangeTo} ${formatDay(r.to, lang)}`;
}

export function RangePicker({
  visible,
  initial,
  onClose,
  onPick,
}: {
  visible: boolean;
  initial: DayRange | null;
  onClose: () => void;
  onPick: (range: DayRange) => void;
}) {
  const now = today();
  const [ym, setYm] = useState(monthOf(initial && initial.to <= now ? initial.to : now));
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);

  function tap(day: string) {
    if (day > now) return;
    if (!from || to) {
      setFrom(day);
      setTo(null);
    } else if (day < from) {
      setFrom(day);
    } else {
      setTo(day);
    }
  }

  function close() {
    setFrom(null);
    setTo(null);
    onClose();
  }

  function apply() {
    if (!from) return;
    onPick({ from, to: to ?? from });
    close();
  }

  const end = to ?? from;
  const prefix = `${ym.y}-${String(ym.m).padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityLabel={t.action.cancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <MonthNav value={ym} onChange={setYm} canGoForward={!now.startsWith(prefix)} />
        <MonthGrid
          value={ym}
          renderDay={(day) => {
            const isEnd = day === from || day === end;
            const between = from && end && day > from && day < end;
            const future = day > now;
            return (
              <Pressable
                disabled={future}
                onPress={() => tap(day)}
                style={[
                  styles.day,
                  between && { backgroundColor: colors.brandSoft },
                  isEnd && styles.dayEnd,
                  future && { opacity: 0.25 },
                ]}>
                <Num bold={isEnd} style={{ fontSize: 17, color: isEnd ? colors.white : colors.text }}>
                  {Number(day.slice(8))}
                </Num>
              </Pressable>
            );
          }}
        />
        <T variant="small" style={{ textAlign: 'center' }}>
          {!from ? t.expense.pickStart : to ? rangeLabel({ from, to }) : t.expense.pickEnd}
        </T>
        <Row>
          <Button label={t.action.cancel} kind="secondary" onPress={close} style={{ flex: 1 }} />
          <Button label={t.expense.showRange} onPress={apply} disabled={!from} style={{ flex: 1 }} />
        </Row>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopStartRadius: 20,
    borderTopEndRadius: 20,
    padding: space.lg,
    gap: space.md,
  },
  day: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayEnd: { backgroundColor: colors.brand },
});
