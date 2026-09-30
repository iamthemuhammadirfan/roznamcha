import { usePathname } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { useProject } from '@/db/hooks';
import { useActiveProject } from '@/state/active-project';
import { t } from '@/i18n';

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
      <T variant="h2" style={styles.title} numberOfLines={1}>
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

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  code: { backgroundColor: colors.white, borderRadius: 8, paddingHorizontal: space.sm },
  codeText: { color: colors.brand, fontSize: 18, lineHeight: 28 },
  title: { color: colors.white },
});
