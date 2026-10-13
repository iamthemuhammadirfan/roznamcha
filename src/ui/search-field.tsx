import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { isUrdu, t } from '@/i18n';

import { colors, fonts, space } from './theme';

/** A search box that looks like one: magnifier, placeholder hint, and a clear button. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  autoFocus,
}: {
  value: string;
  onChangeText: (v: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}) {
  return (
    <View style={styles.box}>
      <MaterialCommunityIcons name="magnify" size={26} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={styles.input}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t.action.cancel} hitSlop={12} onPress={() => onChangeText('')}>
          <MaterialCommunityIcons name="close-circle" size={22} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
  },
  input: {
    flex: 1,
    minHeight: 56,
    fontFamily: isUrdu ? fonts.urdu : fonts.latin,
    fontSize: 18,
    color: colors.text,
  },
});
