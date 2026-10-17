// Full-width rows for the short owner-managed lists Settings opens (trades, expense
// types): a name, how much it's used, and icon actions.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, type TextInputProps, View } from 'react-native';
import Animated, { type SharedValue, useAnimatedStyle } from 'react-native-reanimated';

import { isUrdu } from '@/i18n';

import { Num, T } from './text';
import { colors, fonts, space, TOUCH_MIN } from './theme';

/** A text box in the app's font: the rename box here, and the add bar's. */
export function ListInput({ style, ...rest }: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} {...rest} style={[styles.input, style]} />;
}

/** A small title above a run of rows, e.g. hidden types. */
export function SectionTitle({ title }: { title: string }) {
  return (
    <T variant="small" style={styles.sectionTitle}>
      {title}
    </T>
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
    <View style={styles.meter}>
      <Animated.View style={[styles.meterFill, { width: `${Math.round(share * 100)}%` }, grow]} />
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
    <View>
      {divider ? <View style={styles.divider} /> : null}
      <View style={styles.row}>
        <View style={styles.rowBody}>
          <View style={styles.rowHead}>
            <T variant="bodyBold" style={[styles.label, muted && { color: colors.muted }]}>
              {label}
            </T>
            {count && count.n > 0 ? (
              <View style={styles.count}>
                <Num bold style={{ color: muted ? colors.muted : colors.brand }}>
                  {count.n}
                </Num>
                <T variant="small">{count.unit}</T>
              </View>
            ) : null}
          </View>
          {count ? <Meter share={count.max > 0 ? count.n / count.max : 0} sweep={count.sweep} /> : null}
        </View>
        {children}
      </View>
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
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconAction,
        disabled && { opacity: 0.35 },
        pressed && { backgroundColor: colors.brandSoft },
      ]}>
      <MaterialCommunityIcons name={icon} size={22} color={tone === 'danger' ? colors.recover : colors.brand} />
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
    <View>
      {divider ? <View style={styles.divider} /> : null}
      <View style={[styles.row, styles.editRow]}>
        <ListInput
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSave}
          returnKeyType="done"
          autoFocus
          style={styles.editInput}
        />
        <IconAction icon="check" label={saveLabel} onPress={onSave} disabled={!value.trim()} />
        <IconAction icon="close" label={cancelLabel} onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    paddingHorizontal: space.lg,
    fontFamily: isUrdu ? fonts.urdu : fonts.latin,
    fontSize: 18,
    color: colors.text,
  },
  sectionTitle: { paddingHorizontal: space.lg, paddingTop: space.lg },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginStart: space.lg },
  row: {
    flexDirection: 'row',
    minHeight: TOUCH_MIN,
    alignItems: 'center',
    gap: space.sm,
    paddingStart: space.lg,
    paddingEnd: space.sm,
    paddingVertical: space.xs,
  },
  rowBody: { flex: 1, gap: space.xs, paddingVertical: space.xs },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  label: { flex: 1 },
  count: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  meter: { height: 4, borderRadius: 999, backgroundColor: colors.brandSoft, overflow: 'hidden' },
  meterFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.brand,
    // transformOrigin is physical, and forced RTL doesn't mirror it.
    transformOrigin: isUrdu ? 'right' : 'left',
  },
  iconAction: {
    width: 44,
    height: 44,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRow: { backgroundColor: colors.brandSoft, paddingStart: space.md },
  editInput: { borderRadius: 10, borderColor: colors.brand },
});
