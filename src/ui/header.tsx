import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { usePathname } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useProject } from '@/db/hooks';
import { useActiveProject } from '@/state/active-project';
import { isUrdu, t } from '@/i18n';

import { SyncBadge } from './sync-badge';
import { UpdateStrip } from './update-strip';
import { Num, T } from './text';
import { colors, space } from './theme';

/**
 * Screen title plus the active project's code. The worst bug this app can have is an
 * advance recorded against the wrong project, so the code is always visible.
 */
export function HeaderTitle({ title, scoped = true }: { title: string; scoped?: boolean }) {
  const { projectId } = useActiveProject();
  const p = useProject(scoped ? (projectId ?? null) : null);
  return (
    <View style={styles.row}>
      {p ? (
        <View style={styles.code}>
          <Num bold style={styles.codeText}>
            {p.code}
          </Num>
        </View>
      ) : null}
      <T variant="h2" style={[styles.title, { flex: 1 }]} numberOfLines={1}>
        {title}
      </T>
    </View>
  );
}

const TAB_TITLES: Record<string, { title: string; scoped: boolean }> = {
  '/': { title: t.nav.projects, scoped: false },
  '/directory': { title: t.nav.directory, scoped: false },
  '/settings': { title: t.nav.settings, scoped: false },
};

/** One header above the tab bar; its title follows the selected tab. */
export function TabsHeaderTitle() {
  const tab = TAB_TITLES[usePathname()] ?? TAB_TITLES['/'];
  return <HeaderTitle title={tab.title} scoped={tab.scoped} />;
}

/**
 * The whole header bar, drawn as a plain view instead of custom views placed inside the
 * native Android toolbar. The toolbar sometimes laid those out before React had measured
 * them — the title and sync badge vanished and the bar stretched to a third of the
 * screen. A plain view has no second layout pass to disagree with.
 */
/** The parts of the stack's header props this uses. */
interface HeaderProps {
  navigation: { goBack: () => void };
  options: {
    title?: string;
    headerTitle?: string | ((props: { children: string; tintColor?: string }) => ReactNode);
  };
  back?: unknown;
}

export function AppHeader({ navigation, options, back }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const title =
    typeof options.headerTitle === 'function'
      ? options.headerTitle({ children: options.title ?? '', tintColor: colors.white })
      : null;
  return (
    <View style={[styles.bar, { paddingTop: insets.top }]}>
      <View style={styles.inner}>
        {back ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.action.back}
            hitSlop={8}
            onPress={() => navigation.goBack()}
            style={styles.back}>
            {/* RTL puts the back button on the right, pointing right. */}
            <MaterialCommunityIcons name={isUrdu ? 'arrow-right' : 'arrow-left'} size={26} color={colors.white} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>{title}</View>
        <SyncBadge />
      </View>
      <UpdateStrip />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: colors.brand },
  inner: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  code: { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: space.sm },
  codeText: { color: colors.brand, fontSize: 18, lineHeight: 28 },
  title: { color: colors.white },
});
