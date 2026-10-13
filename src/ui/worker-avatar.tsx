import { StyleSheet, View } from 'react-native';

import { T } from './text';
import { colors } from './theme';

/**
 * The first letter of a worker's name in a hard-hat yellow disc — enough to tell two
 * rows apart at a glance without photos (which v1 deliberately doesn't store).
 */
export function WorkerAvatar({ name, size = 48, inverse }: { name: string; size?: number; inverse?: boolean }) {
  const letter = Array.from(name.trim())[0] ?? '';
  return (
    <View
      style={[
        styles.disc,
        { width: size, height: size, borderRadius: size / 2 },
        inverse && { backgroundColor: colors.white, borderColor: colors.white },
      ]}>
      <T variant="h2" style={{ color: colors.siteInk, fontSize: size * 0.45, lineHeight: size * 0.95 }}>
        {letter}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  disc: {
    backgroundColor: colors.site,
    borderWidth: 2,
    borderColor: colors.siteInk,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
