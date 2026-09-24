import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  StyleSheet,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Num, T } from './text';
import { colors, fonts, space, TOUCH_MIN } from './theme';

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  if (!scroll) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.screen}>
        <View style={styles.screenPad}>{children}</View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView edges={['bottom']} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.screenPad} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  label,
  kind = 'primary',
  busy,
  style,
  ...rest
}: Omit<PressableProps, 'style'> & { label: string; kind?: ButtonKind; busy?: boolean; style?: ViewStyle }) {
  const bg = kind === 'primary' ? colors.brand : kind === 'danger' ? colors.recover : colors.card;
  const fg = kind === 'secondary' ? colors.brand : colors.white;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={busy || rest.disabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: bg, opacity: pressed || rest.disabled ? 0.7 : 1 },
        kind === 'secondary' && styles.buttonOutline,
        style,
      ]}
      {...rest}>
      {busy ? <ActivityIndicator color={fg} /> : (
        // Full-width, centred label: Android mis-measures custom-font text shrink-wrapped
        // inside a centred row and drops the last word ("نیا مزدور" rendered as "نیا").
        <T variant="h2" style={{ color: fg, alignSelf: 'stretch', textAlign: 'center' }}>
          {label}
        </T>
      )}
    </Pressable>
  );
}

export function Field({
  label,
  numeric,
  hint,
  style,
  ...rest
}: TextInputProps & { label: string; numeric?: boolean; hint?: string }) {
  return (
    <View style={styles.field}>
      <T variant="bodyBold">{label}</T>
      <TextInput
        placeholderTextColor={colors.muted}
        {...rest}
        keyboardType={rest.keyboardType ?? (numeric ? 'numeric' : undefined)}
        // Numbers typed LTR, or "5000" renders backwards while typing.
        style={[styles.input, numeric && styles.inputNumeric, style]}
      />
      {hint ? <T variant="small">{hint}</T> : null}
    </View>
  );
}

export function Card({ children, style, onPress }: { children: ReactNode; style?: ViewStyle; onPress?: () => void }) {
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Row({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.row, style]}>{children}</View>;
}

/** Segmented choice with large targets. */
export function Choice<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.choice}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.choiceItem, selected && styles.choiceSelected]}>
            <T variant="h2" style={{ color: selected ? colors.white : colors.brand }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Phone number shown as its own LTR run. */
export function Phone({ value }: { value: string | null }) {
  if (!value) return null;
  return <Num style={{ color: colors.muted, fontSize: 15 }}>{value}</Num>;
}

export function Empty({ text }: { text: string }) {
  return (
    <View style={styles.empty}>
      <T style={{ color: colors.muted, textAlign: 'center' }}>{text}</T>
    </View>
  );
}

export function Banner({ text, tone = 'pending' }: { text: string; tone?: 'pending' | 'recover' | 'brand' }) {
  const bg = tone === 'pending' ? colors.pendingSoft : tone === 'recover' ? colors.recoverSoft : colors.brandSoft;
  const fg = tone === 'pending' ? colors.pending : tone === 'recover' ? colors.recover : colors.brand;
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <T variant="bodyBold" style={{ color: fg }}>
        {text}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  screenPad: { padding: space.lg, gap: space.md, flexGrow: 1 },
  button: {
    minHeight: TOUCH_MIN,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  buttonOutline: { borderWidth: 2, borderColor: colors.brand },
  field: { gap: space.xs },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.card,
    paddingHorizontal: space.md,
    fontFamily: fonts.naskh,
    fontSize: 18,
    color: colors.text,
  },
  // No explicit textAlign: under forced RTL Android mirrors 'left'/'right', so the
  // default (start) is what puts the text on the right.
  inputNumeric: { writingDirection: 'ltr', fontSize: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.lg,
    gap: space.sm,
  },
  pressed: { backgroundColor: colors.brandSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  choice: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  choiceItem: {
    flexGrow: 1,
    minHeight: TOUCH_MIN,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.brand,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
  },
  choiceSelected: { backgroundColor: colors.brand },
  empty: { padding: space.xl, alignItems: 'center' },
  banner: { borderRadius: 10, padding: space.md },
});
