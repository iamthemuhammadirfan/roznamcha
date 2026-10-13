import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { T } from './text';
import { colors, space } from './theme';

/**
 * A screen's main add action, floating over a long list in the bottom corner (the
 * reading-end side). Unlike a full-width footer it gives the list the whole height.
 */
export function Fab({
  icon,
  label,
  onPress,
  quiet,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  /** Outlined instead of filled, when the screen's first step is something else. */
  quiet?: boolean;
}) {
  const fg = quiet ? colors.brand : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.fab, quiet && styles.quiet, pressed && { opacity: 0.85 }]}>
      <MaterialCommunityIcons name={icon} size={24} color={fg} />
      <T variant="bodyBold" style={{ color: fg }}>
        {label}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: space.lg,
    end: space.lg,
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: 999,
    backgroundColor: colors.brand,
    paddingHorizontal: space.lg,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  quiet: { backgroundColor: colors.card, borderWidth: 2, borderColor: colors.brand },
});
