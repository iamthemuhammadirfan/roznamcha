import { useStatus } from '@powersync/react-native';
import { StyleSheet, View } from 'react-native';

import { usePendingUploadCount } from '@/db/hooks';
import { useSession } from '@/state/session';
import { t } from '@/i18n';

import { Num, T } from './text';
import { colors, space } from './theme';

/**
 * Always in the header. Green tick = everything on this phone has reached the server.
 * Amber count = entries that would die with the phone if it were lost now.
 */
export function SyncBadge() {
  const { localMode } = useSession();
  const status = useStatus();
  const pending = usePendingUploadCount();

  if (localMode) return null;

  if (pending > 0) {
    return (
      <View style={[styles.badge, { backgroundColor: colors.pendingSoft }]}>
        <Num bold style={{ color: colors.pending, fontSize: 15 }}>
          {pending}
        </Num>
        <T variant="small" style={{ color: colors.pending }}>
          {status.connected ? t.sync.pending : t.sync.offline}
        </T>
      </View>
    );
  }
  if (!status.connected) {
    return (
      <View style={[styles.badge, { backgroundColor: colors.bg }]}>
        <T variant="small">{status.connecting ? t.sync.connecting : t.sync.offline}</T>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: colors.owedSoft }]}>
      <T variant="bodyBold" style={{ color: colors.owed, fontSize: 15 }}>
        ✓ {t.sync.synced}
      </T>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 2,
  },
});
