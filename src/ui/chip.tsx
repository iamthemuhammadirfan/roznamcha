import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Num, T } from './text';
import { colors, space } from './theme';

/** A filter pill: outlined, filled when selected, with an optional icon and count. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  count,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  icon?: ComponentProps<typeof MaterialCommunityIcons>['name'];
  count?: number;
}) {
  const fg = selected ? colors.white : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && { backgroundColor: colors.brand }]}>
      {icon ? <MaterialCommunityIcons name={icon} size={20} color={fg} /> : null}
      <T variant="bodyBold" style={{ color: fg }}>
        {label}
      </T>
      {count !== undefined ? (
        <View style={[styles.count, selected && { backgroundColor: colors.white }]}>
          <Num bold style={{ fontSize: 13, lineHeight: 20, color: selected ? colors.brand : colors.white }}>
            {count}
          </Num>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: colors.brand,
    paddingHorizontal: space.lg,
  },
  count: {
    minWidth: 22,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: colors.brand,
    paddingHorizontal: 6,
  },
});
