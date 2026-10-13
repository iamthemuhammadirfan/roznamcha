// Tamagui trial (settings screen only). Runtime-only: no compiler or Metro plugin, so the
// native fingerprint — and with it OTA updates — is unchanged. Built from @tamagui/core
// with only our own tokens: the `tamagui` kit and the stock config each add megabytes to
// the bundle.
import { createAnimations } from '@tamagui/animations-reanimated';
import { createFont, createTamagui, createTokens, styled, View } from '@tamagui/core';
import { Platform } from 'react-native';

import { isUrdu } from '@/i18n';

import { colors, fonts as faces, space } from './theme';

// The text scale from text.tsx as Tamagui fonts: a size, line height and weight per
// variant. Every font has every key, so `fontSize="h1"` resolves whichever font is set.
//
// Jameel Noori Nastaleeq has a single weight: its weights are all 400, never bold, or
// Android silently falls back to the system Naskh. Its line heights are ~2× the size —
// Nastaliq stacks letters diagonally and clips in anything tighter.
const urdu = createFont({
  family: faces.urdu,
  size: { title: 32, h1: 27, h2: 22, body: 19, bodyBold: 20, small: 17 },
  lineHeight: { title: 68, h1: 56, h2: 46, body: 40, bodyBold: 42, small: 36 },
  weight: { title: '400', h1: '400', h2: '400', body: '400', bodyBold: '400', small: '400' },
});

// Tamagui needs a family name; theme.ts's `undefined` (system default) crashes createFont.
const system = faces.latin ?? Platform.select({ ios: 'System', default: 'sans-serif' });

const latin = createFont({
  family: system,
  size: { title: 28, h1: 22, h2: 18, body: 17, bodyBold: 17, small: 14 },
  lineHeight: { title: 36, h1: 30, h2: 26, body: 24, bodyBold: 24, small: 20 },
  weight: { title: '700', h1: '700', h2: '700', body: '400', bodyBold: '700', small: '400' },
});

// Latin digits. In Urdu mode Noto Naskh's digits are cleaner at small sizes than
// Nastaliq's; its bold is a separate font file, which `face` swaps in for weight 700.
const digits = createFont({
  family: isUrdu ? faces.digits : system,
  size: { title: 28, h1: 22, h2: 18, body: 17, bodyBold: 17, small: 12 },
  lineHeight: { title: 36, h1: 30, h2: 28, body: 28, bodyBold: 28, small: 28 },
  weight: { title: '700', h1: '700', h2: '700', body: '400', bodyBold: '700', small: '400' },
  // Only when there is one: createFont crashes on `face: undefined`.
  ...(isUrdu && { face: { 400: { normal: faces.digits }, 700: { normal: faces.digitsBold } } }),
});

// Our palette and spacing as tokens (brand, lg, …), so Tamagui screens draw from the same
// values as theme.ts.
const tokens = createTokens({
  color: colors,
  space,
  size: space,
  radius: { sm: 10, md: 14, lg: 16, round: 999 },
  zIndex: { 0: 0, 1: 100 },
});

export const tamaguiConfig = createTamagui({
  tokens,
  // Enter/exit animations (dialogs), run by Reanimated on the UI thread.
  animations: createAnimations({
    quick: { type: 'timing', duration: 160 },
    dialog: { damping: 24, stiffness: 320, mass: 0.9 },
  }),
  // `body` is the UI language's font — fixed per launch, like the layout direction.
  fonts: { body: isUrdu ? urdu : latin, urdu, latin, digits },
  // The app is light-only, so one theme.
  themes: {
    light: {
      background: colors.bg,
      color: colors.text,
      borderColor: colors.border,
    },
  },
  settings: {
    defaultFont: 'body',
    // Values must be tokens or plain numbers/colours, so a typo is a type error.
    allowedStyleValues: 'somewhat-strict',
  },
});

export type Conf = typeof tamaguiConfig;

// Rows and columns. Defined here instead of importing the full `tamagui` kit, which
// pulls every component into the bundle.
export const XStack = styled(View, { flexDirection: 'row' });
export const YStack = styled(View, { flexDirection: 'column' });

declare module '@tamagui/core' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- Tamagui's documented augmentation
  interface TamaguiCustomConfig extends Conf {}
}
