import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { formatRupees, parseRupees } from '@/lib/money';
import { t } from '@/i18n';

import { Row } from './controls';
import { Num, T } from './text';
import { colors, space } from './theme';

/** Round amounts handed over most often; each tap adds to what's typed. */
const QUICK_RUPEES = [500, 1000, 5000];

/** The amount as the biggest thing on the form: large digits, rupees, quick-add chips. */
export function AmountInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const paisa = parseRupees(value) ?? 0;
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ gap: space.sm }}>
        <TextInput
          value={value}
          onChangeText={onChange}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.border}
          accessibilityLabel={t.entry.amount}
          style={styles.amount}
        />
        <T variant="h2" style={{ color: colors.muted }}>
          {t.common.rupees}
        </T>
      </Row>
      <Row style={{ gap: space.sm }}>
        {QUICK_RUPEES.map((r) => (
          <Pressable
            key={r}
            accessibilityRole="button"
            onPress={() => onChange(formatRupees(paisa + r * 100).replace(/,/g, ''))}
            style={styles.quick}>
            {/* The plus is an icon: as text, RTL bidi moves it to the wrong end ("500+"). */}
            <MaterialCommunityIcons name="plus" size={16} color={colors.brand} />
            <Num bold style={{ color: colors.brand, fontSize: 16 }}>
              {formatRupees(r * 100)}
            </Num>
          </Pressable>
        ))}
      </Row>
    </View>
  );
}

const styles = StyleSheet.create({
  amount: {
    flex: 1,
    minHeight: 64,
    fontSize: 40,
    fontWeight: '700',
    color: colors.text,
    // Digits typed LTR so "5000" doesn't render backwards in RTL.
    writingDirection: 'ltr',
    borderBottomWidth: 2,
    borderBottomColor: colors.brand,
    paddingVertical: 0,
  },
  quick: {
    flex: 1,
    minHeight: 44,
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.brandSoft,
  },
});
