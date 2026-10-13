import { Pressable, StyleSheet, View } from 'react-native';

import { addDays, daysBetween, formatDay, today, weekday } from '@/lib/dates';
import { lang, t } from '@/i18n';

import { Row } from './controls';
import { T } from './text';
import { colors, TOUCH_MIN } from './theme';

/** Today or earlier, one day at a time. Never into the future. */
export function DayStepper({ value, onChange }: { value: string; onChange: (day: string) => void }) {
  const back = daysBetween(value, today());
  return (
    // The relative word is never shown alone — کل means both yesterday and tomorrow.
    <Row style={{ justifyContent: 'space-between' }}>
      <Pressable onPress={() => onChange(addDays(value, 1))} disabled={back <= 0} style={styles.step}>
        <T variant="h1" style={{ color: back <= 0 ? colors.border : colors.brand }}>
          +
        </T>
      </Pressable>
      <View style={{ alignItems: 'center' }}>
        <T variant="h2">
          {weekday(value, lang)} {formatDay(value, lang)}
        </T>
        {back === 0 ? <T variant="small">{t.date.today}</T> : null}
        {back === 1 ? <T variant="small">{t.date.yesterday}</T> : null}
      </View>
      <Pressable onPress={() => onChange(addDays(value, -1))} style={styles.step}>
        <T variant="h1" style={{ color: colors.brand }}>
          −
        </T>
      </Pressable>
    </Row>
  );
}

const styles = StyleSheet.create({
  step: {
    width: TOUCH_MIN,
    height: TOUCH_MIN,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
