import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ListInput } from './list-group';
import { T } from './text';
import { colors, space } from './theme';

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
    <View style={styles.bar}>
      {blocked ? (
        <T variant="small" style={styles.blocked}>
          {blocked}
        </T>
      ) : null}
      <View style={styles.row}>
        <ListInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          onSubmitEditing={() => !empty && onAdd()}
          returnKeyType="done"
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={addLabel}
          disabled={empty}
          onPress={onAdd}
          style={({ pressed }) => [
            styles.add,
            { backgroundColor: pressed ? colors.siteInk : colors.brand },
            empty && { opacity: 0.4 },
          ]}>
          <MaterialCommunityIcons name="plus" size={30} color={colors.white} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { gap: space.xs },
  blocked: { color: colors.pending, paddingHorizontal: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  input: { minHeight: 56, borderRadius: 999 },
  add: { width: 56, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
