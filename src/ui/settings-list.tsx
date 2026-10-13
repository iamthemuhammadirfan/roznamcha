// Grouped settings list: a titled section holds rows in one rounded container, with a
// divider between rows that starts after the icon. Adding a setting is one <SettingsRow>.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Children, type ComponentProps, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { isUrdu } from '@/i18n';

import { T } from './text';
import { colors, space, TOUCH_MIN } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON_TILE = 38;

export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  if (rows.length === 0) return null;
  return (
    <View style={styles.section}>
      {title ? (
        <T variant="small" style={styles.sectionTitle}>
          {title}
        </T>
      ) : null}
      <View style={styles.group}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 ? <View style={styles.divider} /> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  );
}

export function SettingsRow({
  icon,
  label,
  detail,
  value,
  onPress,
  tone = 'default',
}: {
  icon: IconName;
  label: string;
  /** A second line under the label, e.g. sync status. */
  detail?: ReactNode;
  /** Shown at the end of the row, before the chevron. */
  value?: ReactNode;
  onPress?: () => void;
  tone?: 'default' | 'danger';
}) {
  const danger = tone === 'danger';
  const fg = danger ? colors.recover : colors.brand;
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.brandSoft }]}>
      <View style={[styles.tile, { backgroundColor: danger ? colors.recoverSoft : colors.brandSoft }]}>
        <MaterialCommunityIcons name={icon} size={22} color={fg} />
      </View>
      <View style={styles.text}>
        <T variant="bodyBold" style={danger ? { color: colors.recover } : undefined}>
          {label}
        </T>
        {typeof detail === 'string' ? <T variant="small">{detail}</T> : detail}
      </View>
      {typeof value === 'string' ? <T style={{ color: colors.muted }}>{value}</T> : value}
      {onPress && !danger ? (
        // Forced RTL mirrors the layout but not the glyph, so pick the one that points inward.
        <MaterialCommunityIcons name={isUrdu ? 'chevron-left' : 'chevron-right'} size={24} color={colors.border} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { gap: space.xs },
  sectionTitle: { paddingHorizontal: space.sm },
  group: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginStart: space.lg + ICON_TILE + space.md,
  },
  row: {
    minHeight: TOUCH_MIN,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  tile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, flexShrink: 1 },
});
