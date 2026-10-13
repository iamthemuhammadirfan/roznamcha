// A date you can set to any past day in one or two taps: shows the chosen day, opens a
// month calendar. For dates that may be weeks back (a worker's start date), where the
// + / − day stepper would take dozens of taps.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { daysBetween, formatDay, today, weekday } from '@/lib/dates';
import { lang, t } from '@/i18n';

import { Button } from './controls';
import { MonthGrid, MonthNav, monthOf } from './month-grid';
import { Num, T } from './text';
import { colors, space, TOUCH_MIN } from './theme';

export function DateField({
  label,
  value,
  onChange,
  disabled,
  inline,
}: {
  label: string;
  value: string;
  onChange: (day: string) => void;
  disabled?: boolean;
  /** One quiet line — label, date, edit — for a date that is set once and rarely changed. */
  inline?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const back = daysBetween(value, today());
  const sheet = (
    <DaySheet
      visible={open}
      value={value}
      onClose={() => setOpen(false)}
      onPick={(d) => {
        setOpen(false);
        onChange(d);
      }}
    />
  );
  if (inline) {
    return (
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={styles.inline}>
        <MaterialCommunityIcons name="calendar-start" size={20} color={colors.muted} />
        <T variant="small">{label}</T>
        <T variant="small" style={{ flex: 1, color: colors.text }}>
          {formatDay(value, lang)}
        </T>
        {!disabled ? (
          <T variant="small" style={{ color: colors.brand }}>
            {t.action.edit}
          </T>
        ) : null}
        {sheet}
      </Pressable>
    );
  }
  return (
    <View style={{ gap: space.xs }}>
      <T variant="bodyBold">{label}</T>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.field, pressed && { backgroundColor: colors.brandSoft }]}>
        <MaterialCommunityIcons name="calendar-range" size={26} color={colors.brand} />
        <View style={{ flex: 1 }}>
          <T variant="h2">
            {weekday(value, lang)} {formatDay(value, lang)}
          </T>
          {back === 0 ? <T variant="small">{t.date.today}</T> : null}
        </View>
        {!disabled ? (
          <T variant="small" style={{ color: colors.brand }}>
            {t.action.edit}
          </T>
        ) : null}
      </Pressable>
      {sheet}
    </View>
  );
}

function DaySheet({
  visible,
  value,
  onClose,
  onPick,
}: {
  visible: boolean;
  value: string;
  onClose: () => void;
  onPick: (day: string) => void;
}) {
  const now = today();
  const [ym, setYm] = useState(monthOf(value));
  const prefix = `${ym.y}-${String(ym.m).padStart(2, '0')}`;
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.action.cancel} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <MonthNav value={ym} onChange={setYm} canGoForward={!now.startsWith(prefix)} />
        <MonthGrid
          value={ym}
          renderDay={(day) => {
            const chosen = day === value;
            const future = day > now;
            return (
              <Pressable
                disabled={future}
                onPress={() => onPick(day)}
                style={[styles.day, chosen && styles.dayChosen, day === now && !chosen && styles.dayToday, future && { opacity: 0.25 }]}>
                <Num bold={chosen} style={{ fontSize: 17, color: chosen ? colors.white : colors.text }}>
                  {Number(day.slice(8))}
                </Num>
              </Pressable>
            );
          }}
        />
        <T variant="small" style={{ textAlign: 'center' }}>
          {t.date.pick}
        </T>
        <Button label={t.action.cancel} kind="secondary" onPress={onClose} />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
  },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 44 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopStartRadius: 20,
    borderTopEndRadius: 20,
    padding: space.lg,
    gap: space.md,
  },
  day: { flex: 1, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayChosen: { backgroundColor: colors.brand },
  dayToday: { borderWidth: 2, borderColor: colors.site },
});
