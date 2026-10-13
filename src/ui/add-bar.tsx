// Built with Tamagui (Settings only).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { View } from '@tamagui/core';

import { ListInput } from './list-group';
import { XStack, YStack } from './tamagui.config';
import { Text } from './tamagui-text';
import { colors } from './theme';

/**
 * Type a name, tap plus — for short owner-managed lists (trades, expense types). Lives in
 * a screen's pinned footer, like a message composer. What's typed also filters the list
 * above, so one box searches and adds, and an existing name is seen before it's re-added.
 */
export function AddBar({
  value,
  onChangeText,
  placeholder,
  onAdd,
  addLabel,
  blocked,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  onAdd: () => void;
  addLabel: string;
  /** Why adding what's typed isn't possible (e.g. it already exists); disables the plus. */
  blocked?: string | null;
}) {
  const empty = !value.trim() || Boolean(blocked);
  return (
    <YStack gap="xs">
      {blocked ? (
        <Text variant="small" color="pending" paddingHorizontal="md">
          {blocked}
        </Text>
      ) : null}
      <XStack alignItems="center" gap="sm">
        <ListInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="muted"
          onSubmitEditing={() => !empty && onAdd()}
          returnKeyType="done"
          minHeight={56}
          borderRadius="round"
        />
        <View
          role="button"
          aria-label={addLabel}
          disabled={empty}
          onPress={onAdd}
          width={56}
          height={56}
          borderRadius="round"
          alignItems="center"
          justifyContent="center"
          opacity={empty ? 0.4 : 1}
          backgroundColor={{ default: 'brand', press: 'siteInk' }}>
          <MaterialCommunityIcons name="plus" size={30} color={colors.white} />
        </View>
      </XStack>
    </YStack>
  );
}
