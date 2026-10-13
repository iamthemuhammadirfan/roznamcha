// Settings list: plain full-width rows under a section title, with a divider between
// rows that starts after the icon. No boxes — the stage above carries the weight.
// Adding a setting is one <SettingsRow>. Built with Tamagui (Settings only).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Children, type ComponentProps, Fragment, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { styled, View } from '@tamagui/core';

import { isUrdu } from '@/i18n';

import { XStack, YStack } from './tamagui.config';
import { Text } from './tamagui-text';
import { colors, space, TOUCH_MIN } from './theme';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

const ICON = 26;

const Divider = styled(View, {
  height: StyleSheet.hairlineWidth,
  backgroundColor: 'border',
  marginStart: space.lg + ICON + space.lg,
});

const RowFrame = styled(XStack, {
  minHeight: TOUCH_MIN,
  alignItems: 'center',
  gap: 'lg',
  paddingHorizontal: 'lg',
  paddingVertical: 'sm',
});

export function SettingsSection({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  if (rows.length === 0) return null;
  return (
    <YStack>
      {title ? (
        <Text variant="small" paddingHorizontal="lg">
          {title}
        </Text>
      ) : null}
      {rows.map((row, i) => (
        <Fragment key={i}>
          {i > 0 ? <Divider /> : null}
          {row}
        </Fragment>
      ))}
    </YStack>
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
    <RowFrame
      role={onPress ? 'button' : undefined}
      disabled={!onPress}
      onPress={onPress}
      backgroundColor={onPress ? { default: 'transparent', press: 'brandSoft' } : undefined}>
      <MaterialCommunityIcons name={icon} size={ICON} color={fg} />
      <YStack flex={1} flexShrink={1}>
        <Text variant="bodyBold" color={danger ? 'recover' : 'text'}>
          {label}
        </Text>
        {typeof detail === 'string' ? <Text variant="small">{detail}</Text> : detail}
      </YStack>
      {typeof value === 'string' ? <Text color="muted">{value}</Text> : value}
      {onPress && !danger ? (
        // Forced RTL mirrors the layout but not the glyph, so pick the one that points inward.
        <MaterialCommunityIcons name={isUrdu ? 'chevron-left' : 'chevron-right'} size={24} color={colors.border} />
      ) : null}
    </RowFrame>
  );
}
