import { StyleSheet, Text, type TextProps, View } from 'react-native';

import { formatRupees } from '@/lib/money';
import { ur } from '@/strings.ur';

import { colors, fonts } from './theme';

type Variant = 'title' | 'h1' | 'h2' | 'body' | 'bodyBold' | 'small';

export function T({ variant = 'body', style, ...rest }: TextProps & { variant?: Variant }) {
  return <Text {...rest} style={[styles.base, styles[variant], style]} />;
}

/**
 * Digits in their own LTR run. Mixing digits into an Urdu string lets the bidi
 * algorithm reorder "5,000" or "03001234567" — keep them separate.
 */
export function Num({ style, bold, ...rest }: TextProps & { bold?: boolean }) {
  return <Text {...rest} style={[styles.base, styles.num, bold && styles.numBold, style]} />;
}

/** "5,000 روپے" — never a ₨ sign, never a minus sign. */
export function Money({ paisa, size = 18, color = colors.text }: { paisa: number; size?: number; color?: string }) {
  return (
    <View style={styles.moneyRow}>
      <Num bold style={{ fontSize: size, lineHeight: size * 1.5, color }}>
        {formatRupees(paisa)}
      </Num>
      <T style={{ fontSize: size * 0.75, lineHeight: size * 1.5, color }}> {ur.common.rupees}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  // Nastaliq needs very generous line height or descenders clip. Title only.
  title: { fontFamily: fonts.nastaliq, fontSize: 26, lineHeight: 64 },
  h1: { fontFamily: fonts.naskhBold, fontSize: 22, lineHeight: 36 },
  h2: { fontFamily: fonts.naskhBold, fontSize: 18, lineHeight: 30 },
  body: { fontFamily: fonts.naskh, fontSize: 17, lineHeight: 28 },
  bodyBold: { fontFamily: fonts.naskhBold, fontSize: 17, lineHeight: 28 },
  small: { fontFamily: fonts.naskh, fontSize: 14, lineHeight: 22, color: colors.muted },
  num: { fontFamily: fonts.naskh, fontSize: 17, lineHeight: 28, writingDirection: 'ltr' },
  numBold: { fontFamily: fonts.naskhBold },
  moneyRow: { flexDirection: 'row', alignItems: 'baseline' },
});
