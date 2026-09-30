import { StyleSheet, Text, type TextProps, type TextStyle, View } from 'react-native';

import { lang as appLang, type Lang } from '@/i18n';
import { formatRupees } from '@/lib/money';
import { en } from '@/strings.en';
import { ur } from '@/strings.ur';

import { colors, fonts } from './theme';

type Variant = 'title' | 'h1' | 'h2' | 'body' | 'bodyBold' | 'small';

// Jameel Noori Nastaleeq has a single weight. Never set fontWeight on Urdu text: Android
// can't find a bold file for the custom font and silently falls back to the system
// Naskh. Headings are emphasised by size instead. Line heights are ~2× the font size —
// Nastaliq stacks letters diagonally and clips in anything tighter.
const urdu = StyleSheet.create({
  title: { fontFamily: fonts.urdu, fontSize: 32, lineHeight: 68 },
  h1: { fontFamily: fonts.urdu, fontSize: 27, lineHeight: 56 },
  h2: { fontFamily: fonts.urdu, fontSize: 22, lineHeight: 46 },
  body: { fontFamily: fonts.urdu, fontSize: 19, lineHeight: 40 },
  bodyBold: { fontFamily: fonts.urdu, fontSize: 20, lineHeight: 42 },
  small: { fontFamily: fonts.urdu, fontSize: 17, lineHeight: 36, color: colors.muted },
});

const latin = StyleSheet.create({
  title: { fontFamily: fonts.latin, fontWeight: '700', fontSize: 28, lineHeight: 36 },
  h1: { fontFamily: fonts.latin, fontWeight: '700', fontSize: 22, lineHeight: 30 },
  h2: { fontFamily: fonts.latin, fontWeight: '700', fontSize: 18, lineHeight: 26 },
  body: { fontFamily: fonts.latin, fontSize: 17, lineHeight: 24 },
  bodyBold: { fontFamily: fonts.latin, fontWeight: '700', fontSize: 17, lineHeight: 24 },
  small: { fontFamily: fonts.latin, fontSize: 14, lineHeight: 20, color: colors.muted },
});

/** Text in the app's language, or `script="ur"` to force Urdu (the parchi). */
export function T({
  variant = 'body',
  script = appLang,
  style,
  ...rest
}: TextProps & { variant?: Variant; script?: Lang }) {
  const set = script === 'ur' ? urdu : latin;
  return <Text {...rest} style={[styles.base, set[variant], style]} />;
}

/**
 * Digits in their own LTR run. Mixing digits into an Urdu string lets the bidi
 * algorithm reorder "5,000" or "03001234567" — keep them separate.
 */
export function Num({ style, bold, script = appLang, ...rest }: TextProps & { bold?: boolean; script?: Lang }) {
  const face: TextStyle =
    script === 'ur'
      ? { fontFamily: bold ? fonts.digitsBold : fonts.digits }
      : { fontFamily: fonts.latin, fontWeight: bold ? '700' : '400' };
  return <Text {...rest} style={[styles.base, styles.num, face, style]} />;
}

/**
 * Urdu: "5,000 روپے". English: "Rs 5,000". Never a ₨ sign (tofu on cheap phones) and
 * never a minus sign — the balance chip says in words who owes whom.
 */
export function Money({
  paisa,
  size = 18,
  color = colors.text,
  script = appLang,
}: {
  paisa: number;
  size?: number;
  color?: string;
  script?: Lang;
}) {
  const amount = (
    <Num bold script={script} style={{ fontSize: size, lineHeight: size * 1.5, color }}>
      {formatRupees(paisa)}
    </Num>
  );
  if (script === 'en') {
    return (
      <View style={styles.moneyRow}>
        <T script="en" style={{ fontSize: size * 0.75, lineHeight: size * 1.5, color }}>
          {en.common.rupees}{' '}
        </T>
        {amount}
      </View>
    );
  }
  return (
    <View style={styles.moneyRow}>
      {amount}
      <T script="ur" style={{ fontSize: size * 0.75, lineHeight: size * 1.6, color }}>
        {' '}
        {ur.common.rupees}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { color: colors.text },
  num: { fontSize: 17, lineHeight: 28, writingDirection: 'ltr' },
  moneyRow: { flexDirection: 'row', alignItems: 'baseline' },
});
