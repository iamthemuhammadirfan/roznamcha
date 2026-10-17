// Screen scaffolding for the Settings pages (Trades, Expense types): the page's own list
// (a FlatList, so long lists render only what's on screen) filling the space above an
// optional footer pinned to the bottom. controls.tsx has the app-wide ones.
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Banner } from './controls';
import { useKeyboardHeight } from './keyboard';
import { colors, space } from './theme';

export function ListScreen({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  const keyboard = useKeyboardHeight();
  return (
    // Lift the footer by the keyboard's height; the bottom inset it replaces is already
    // part of what the keyboard covers.
    <SafeAreaView edges={['bottom']} style={[styles.screen, keyboard > 0 && { paddingBottom: keyboard }]}>
      <View style={styles.body}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

/** controls.tsx's Banner, inset from the screen edges. */
export function ListBanner(props: Parameters<typeof Banner>[0]) {
  return (
    <View style={styles.banner}>
      <Banner {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { flex: 1 },
  footer: {
    gap: space.sm,
    padding: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  banner: { margin: space.lg, marginBottom: 0 },
});
