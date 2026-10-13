// Full-width rows for the short owner-managed lists Settings opens (trades, expense
// types): a name, how much it's used, and icon actions.
// Built with Tamagui (Settings only).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { styled, View } from '@tamagui/core';
import { Input } from '@tamagui/input';
import { type ComponentProps, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { isUrdu } from '@/i18n';

import { XStack, YStack } from './tamagui.config';
import { Digits, Text } from './tamagui-text';
import { colors, TOUCH_MIN } from './theme';

const Divider = styled(View, {
  height: StyleSheet.hairlineWidth,
  backgroundColor: 'border',
  marginStart: 'lg',
});

const RowFrame = styled(XStack, {
  minHeight: TOUCH_MIN,
  alignItems: 'center',
  gap: 'sm',
  paddingStart: 'lg',
  paddingEnd: 'sm',
  paddingVertical: 'xs',
});

/** A text box in the app's font: the rename box here, and the add bar's. */
export const ListInput = styled(Input, {
  flex: 1,
  minHeight: 52,
  borderWidth: 1,
  borderColor: 'border',
  backgroundColor: 'card',
  paddingHorizontal: 'lg',
  fontFamily: 'body',
  fontSize: 18,
  color: 'text',
});

/** A small title above a run of rows, e.g. hidden types. */
export function SectionTitle({ title }: { title: string }) {
  return (
    <Text variant="small" paddingHorizontal="lg" paddingTop="lg">
      {title}
    </Text>
  );
}

/**
 * How much of the whole this row carries — workers in a trade, expenses of a type — as a
 * thin bar under its name. Grows in from the reading side as `sweep` goes 0 → 1; every
 * row shares one sweep, so it is one animation however long the list.
 */
function Meter({ share, sweep }: { share: number; sweep: SharedValue<number> }) {
  const grow = useAnimatedStyle(() => ({ transform: [{ scaleX: sweep.get() }] }));
  return (
    <View height={4} borderRadius="round" backgroundColor="brandSoft" overflow="hidden">
      <Animated.View
        style={[
          {
            height: '100%',
            width: `${Math.round(share * 100)}%`,
            borderRadius: 999,
            backgroundColor: colors.brand,
            // transformOrigin is physical, and forced RTL doesn't mirror it.
            transformOrigin: isUrdu ? 'right' : 'left',
          },
          grow,
        ]}
      />
    </View>
  );
}

/** A name, its count and share meter, then icon actions. */
export function ListRow({
  label,
  count,
  muted,
  divider,
  children,
}: {
  label: string;
  /** How many use this, of how many in all, and what they are ("workers"). */
  count?: { n: number; max: number; unit: string; sweep: SharedValue<number> };
  muted?: boolean;
  /** A divider above: every row but the first of its run. */
  divider?: boolean;
  /** IconActions. */
  children?: ReactNode;
}) {
  return (
    <YStack>
      {divider ? <Divider /> : null}
      <RowFrame>
        <YStack flex={1} gap="xs" paddingVertical="xs">
          <XStack alignItems="center" gap="sm">
            <Text variant="bodyBold" flex={1} color={muted ? 'muted' : 'text'}>
              {label}
            </Text>
            {count && count.n > 0 ? (
              <XStack alignItems="center" gap="xs">
                <Digits bold color={muted ? 'muted' : 'brand'}>
                  {count.n}
                </Digits>
                <Text variant="small">{count.unit}</Text>
              </XStack>
            ) : null}
          </XStack>
          {count ? <Meter share={count.max > 0 ? count.n / count.max : 0} sweep={count.sweep} /> : null}
        </YStack>
        {children}
      </RowFrame>
    </YStack>
  );
}

/** A 44dp round icon button inside a row. */
export function IconAction({
  icon,
  label,
  onPress,
  tone = 'brand',
  disabled,
}: {
  icon: ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
  tone?: 'brand' | 'danger';
  disabled?: boolean;
}) {
  return (
    <View
      role="button"
      aria-label={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      width={44}
      height={44}
      borderRadius="round"
      alignItems="center"
      justifyContent="center"
      opacity={disabled ? 0.35 : 1}
      backgroundColor={{ default: 'transparent', press: 'brandSoft' }}>
      <MaterialCommunityIcons name={icon} size={22} color={tone === 'danger' ? colors.recover : colors.brand} />
    </View>
  );
}

/** A row being renamed in place: a text box with save and cancel. */
export function EditRow({
  value,
  onChangeText,
  onSave,
  onCancel,
  saveLabel,
  cancelLabel,
  divider,
}: {
  divider?: boolean;
  value: string;
  onChangeText: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
}) {
  return (
    <YStack>
      {divider ? <Divider /> : null}
    <RowFrame backgroundColor="brandSoft" paddingStart="md">
      <ListInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSave}
        returnKeyType="done"
        autoFocus
        borderRadius="sm"
        borderColor="brand"
      />
      <IconAction icon="check" label={saveLabel} onPress={onSave} disabled={!value.trim()} />
      <IconAction icon="close" label={cancelLabel} onPress={onCancel} />
    </RowFrame>
    </YStack>
  );
}
