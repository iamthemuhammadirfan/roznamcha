import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import type { Project } from '@/db/schema';
import { t } from '@/i18n';
import { type ProjectAccess, togglePick } from '@/lib/access';

import { CodePlate } from './site-board';
import { T } from './text';
import { colors, space, TOUCH_MIN } from './theme';

/**
 * The owner picks a munshi's projects: "All projects" (new ones too), or a tick per
 * project. Open projects first, then closed ones. Used when adding a munshi and when
 * editing one.
 */
export function ProjectAccessPicker({
  projects,
  value,
  onChange,
}: {
  projects: Project[];
  value: ProjectAccess;
  onChange: (next: ProjectAccess) => void;
}) {
  const sorted = [...projects].sort((a, b) => Number(b.is_active) - Number(a.is_active));
  const nothing = !value.all && !value.ids.some((id) => projects.some((p) => p.id === id));
  return (
    <View style={styles.box}>
      <View style={{ gap: space.xs }}>
        <T variant="bodyBold">{t.team.access.title}</T>
        <T variant="small">{t.team.access.hint}</T>
      </View>

      <Tick
        checked={value.all}
        onPress={() => onChange({ ...value, all: !value.all })}
        label={t.team.access.all}
        detail={t.team.access.allHint}
        testID="access-all"
      />

      {value.all
        ? null
        : sorted.map((p) => (
            <Tick
              key={p.id}
              checked={value.ids.includes(p.id)}
              onPress={() => onChange({ ...value, ids: togglePick(value.ids, p.id) })}
              label={p.name_ur}
              detail={p.is_active ? undefined : t.project.archived}
              code={p.code}
              testID={`access-${p.code}`}
            />
          ))}

      {!value.all && projects.length === 0 ? <T variant="small">{t.team.access.noProjects}</T> : null}
      {nothing ? (
        <T variant="small" style={{ color: colors.pending }}>
          {t.team.access.noneHint}
        </T>
      ) : null}
    </View>
  );
}

function Tick({
  checked,
  onPress,
  label,
  detail,
  code,
  testID,
}: {
  checked: boolean;
  onPress: () => void;
  label: string;
  detail?: string;
  code?: string;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={code ? `${code}, ${label}` : label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.row, checked && styles.rowOn, pressed && { backgroundColor: colors.brandSoft }]}>
      <MaterialCommunityIcons
        name={checked ? 'checkbox-marked' : 'checkbox-blank-outline'}
        size={28}
        color={checked ? colors.brand : colors.muted}
      />
      {code ? <CodePlate code={code} size={18} /> : null}
      <View style={{ flex: 1 }}>
        <T variant="bodyBold" numberOfLines={1}>
          {label}
        </T>
        {detail ? <T variant="small">{detail}</T> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: { gap: space.sm },
  row: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  rowOn: { borderColor: colors.brand },
});
