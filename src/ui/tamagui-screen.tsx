// Screen scaffolding for the Settings pages (Trades, Expense types): the page's own list
// (a FlatList, so long lists render only what's on screen) filling the space above an
// optional footer pinned to the bottom. Built with Tamagui (Settings only); controls.tsx
// has the app-wide ones.
import { View } from '@tamagui/core';
import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useKeyboardHeight } from './keyboard';
import { Text } from './tamagui-text';
import { colors } from './theme';

export function ListScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const keyboard = useKeyboardHeight();
  return (
    // Lift the footer by the keyboard's height; the bottom inset it replaces is already
    // part of what the keyboard covers.
    <SafeAreaView
      edges={['bottom']}
      style={{ flex: 1, backgroundColor: colors.bg, paddingBottom: keyboard > 0 ? keyboard : undefined }}>
      <View flex={1}>{children}</View>
      {footer ? (
        <View
          gap="sm"
          padding="lg"
          paddingTop="sm"
          borderTopWidth={StyleSheet.hairlineWidth}
          borderTopColor="border"
          backgroundColor="bg">
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const TONE = {
  pending: { bg: 'pendingSoft', fg: 'pending' },
  recover: { bg: 'recoverSoft', fg: 'recover' },
  brand: { bg: 'brandSoft', fg: 'brand' },
} as const;

export function Banner({ text, tone = 'pending' }: { text: string; tone?: keyof typeof TONE }) {
  return (
    <View margin="lg" marginBottom={0} borderRadius="sm" padding="md" backgroundColor={TONE[tone].bg}>
      <Text variant="bodyBold" color={TONE[tone].fg}>
        {text}
      </Text>
    </View>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <View padding="xl" alignItems="center">
      {/* Stretched: shrink-wrapped Nastaliq gets its last word dropped on Android. */}
      <Text color="muted" textAlign="center" alignSelf="stretch">
        {text}
      </Text>
    </View>
  );
}
