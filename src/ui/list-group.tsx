// Compact rows in one rounded container with dividers — for short owner-managed lists
// (trades, expense types) where a card per item wasted most of the screen.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Children, type ComponentProps, Fragment, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { isUrdu } from '@/i18n';

import { T } from './text';
import { colors, fonts, space } from './theme';

export function ListGroup({ title, children }: { title?: string; children: ReactNode }) {
  const rows = Children.toArray(children);
  if (rows.length === 0) return null;
  return (
    <View style={{ gap: space.xs }}>
      {title ? (
        <T variant="small" style={{ paddingHorizontal: space.sm }}>
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

/** A name, an optional detail at the end, then icon actions. */
export function ListRow({
  label,
  detail,
  muted,
  children,
}: {
  label: string;
  detail?: ReactNode;
  muted?: boolean;
  /** IconActions. */
  children?: ReactNode;
}) {
  return (
    <View style={styles.row}>
      <T variant="bodyBold" style={{ flex: 1, color: muted ? colors.muted : colors.text }}>
        {label}
      </T>
      {detail}
      {children}
    </View>
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
  const fg = tone === 'danger' ? colors.recover : colors.brand;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.action,
        pressed && { backgroundColor: colors.brandSoft },
        disabled && { opacity: 0.35 },
      ]}>
      <MaterialCommunityIcons name={icon} size={22} color={fg} />
    </Pressable>
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
}: {
  value: string;
  onChangeText: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  saveLabel: string;
  cancelLabel: string;
}) {
  return (
    <View style={[styles.row, styles.editing]}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSave}
        returnKeyType="done"
        autoFocus
        style={styles.input}
      />
      <IconAction icon="check" label={saveLabel} onPress={onSave} disabled={!value.trim()} />
      <IconAction icon="close" label={cancelLabel} onPress={onCancel} />
    </View>
  );
}

const styles = StyleSheet.create({
  editing: { backgroundColor: colors.brandSoft, paddingStart: space.md },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    fontFamily: isUrdu ? fonts.urdu : fonts.latin,
    fontSize: 18,
    color: colors.text,
  },
  group: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginStart: space.lg },
  row: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingStart: space.lg,
    paddingEnd: space.sm,
    paddingVertical: space.xs,
  },
  action: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
