import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { isUrdu } from '@/i18n';

import { T } from './text';
import { colors, fonts, space } from './theme';

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
    <View style={{ gap: space.xs }}>
      {blocked ? (
        <T variant="small" style={{ color: colors.pending, paddingHorizontal: space.md }}>
          {blocked}
        </T>
      ) : null}
      <View style={styles.bar}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.muted}
          onSubmitEditing={() => !empty && onAdd()}
          returnKeyType="done"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          disabled={empty}
          onPress={onAdd}
          style={[styles.add, empty && { opacity: 0.4 }]}>
          <MaterialCommunityIcons name="plus" size={30} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: {
    flex: 1,
    minHeight: 56,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    fontFamily: isUrdu ? fonts.urdu : fonts.latin,
    fontSize: 18,
    color: colors.text,
  },
  add: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
