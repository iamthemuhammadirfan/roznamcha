// Tamagui twins of T and Num (text.tsx), for screens on the Tamagui trial. Sizes, line
// heights and weights come from the fonts in tamagui.config.ts, so the Urdu rules there
// (one weight, ~2× line height) hold here too.
import { styled, Text as TamaguiText } from '@tamagui/core';

const variant = {
  title: { fontSize: 'title', lineHeight: 'title', fontWeight: 'title' },
  h1: { fontSize: 'h1', lineHeight: 'h1', fontWeight: 'h1' },
  h2: { fontSize: 'h2', lineHeight: 'h2', fontWeight: 'h2' },
  body: { fontSize: 'body', lineHeight: 'body', fontWeight: 'body' },
  bodyBold: { fontSize: 'bodyBold', lineHeight: 'bodyBold', fontWeight: 'bodyBold' },
  small: { fontSize: 'small', lineHeight: 'small', fontWeight: 'small', color: 'muted' },
} as const;

/** Text in the app's language. */
export const Text = styled(TamaguiText, {
  fontFamily: 'body',
  color: 'text',
  variants: { variant },
  defaultVariants: { variant: 'body' },
});

/**
 * Digits in their own LTR run. Mixing digits into an Urdu string lets the bidi
 * algorithm reorder "5,000" or "03001234567" — keep them separate.
 */
// Not styled(Text): its variant sizes would resolve against the `body` font first.
export const Digits = styled(TamaguiText, {
  fontFamily: 'digits',
  color: 'text',
  writingDirection: 'ltr',
  variants: {
    variant,
    bold: { true: { fontWeight: '700' } },
  } as const,
  defaultVariants: { variant: 'body' },
});
