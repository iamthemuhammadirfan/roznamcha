// A confirm / choose dialog for the Settings screens, in place of the platform alert:
// large stacked buttons a dusty thumb can't miss, the app's own fonts (Urdu included),
// and a short ease in on the UI thread.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { Easing, Keyframe } from 'react-native-reanimated';

import { T } from './text';
import { colors, space, TOUCH_MIN } from './theme';

export interface DialogAction {
  label: string;
  onPress: () => void;
  /** `danger` for what can't be taken back; `current` marks the choice already in effect. */
  tone?: 'brand' | 'danger' | 'current';
}

// Rises a little and settles to full size. Reanimated skips it when the phone asks for
// reduced motion.
const enter = new Keyframe({
  0: { opacity: 0, transform: [{ translateY: 16 }, { scale: 0.94 }] },
  100: { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }], easing: Easing.out(Easing.cubic) },
}).duration(220);

export function ChoiceDialog({
  open,
  onClose,
  title,
  description,
  actions,
  cancelLabel,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  actions: DialogAction[];
  cancelLabel: string;
}) {
  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Tapping outside the dialog cancels, like the back button. */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
        <Animated.View entering={enter} style={styles.content} accessibilityViewIsModal>
          <View style={styles.head}>
            <T variant="h2" accessibilityRole="header">
              {title}
            </T>
            {description ? <T variant="small">{description}</T> : null}
          </View>

          <View style={styles.actions}>
            {actions.map((a) => {
              const current = a.tone === 'current';
              const bg = current ? colors.brandSoft : a.tone === 'danger' ? colors.recover : colors.brand;
              const pressedBg = current ? colors.border : colors.siteInk;
              return (
                <Pressable
                  key={a.label}
                  accessibilityRole="button"
                  accessibilityState={{ selected: current }}
                  onPress={() => {
                    onClose();
                    a.onPress();
                  }}
                  style={({ pressed }) => [
                    styles.action,
                    { backgroundColor: pressed ? pressedBg : bg },
                    current && styles.actionCurrent,
                  ]}>
                  {current ? <MaterialCommunityIcons name="check" size={20} color={colors.brand} /> : null}
                  <T variant="bodyBold" style={{ color: current ? colors.brand : colors.white }}>
                    {a.label}
                  </T>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.brandSoft }]}>
              <T variant="bodyBold" style={{ color: colors.muted }}>
                {cancelLabel}
              </T>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(15,30,23,0.62)',
  },
  content: {
    width: '88%',
    maxWidth: 420,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: space.xl,
    gap: space.lg,
  },
  head: { gap: space.xs },
  actions: { gap: space.sm },
  action: {
    minHeight: TOUCH_MIN - 8,
    borderRadius: 14,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  actionCurrent: { borderWidth: 2, borderColor: colors.brand },
});
