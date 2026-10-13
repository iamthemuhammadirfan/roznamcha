import * as Updates from 'expo-updates';
import { Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';

import { Num, T } from './text';
import { colors, space } from './theme';

/**
 * Over-the-air update status, attached under the header on every screen. Expo checks on
 * launch and downloads in the background; this makes that visible: a yellow progress bar
 * while downloading, then a restart button once it's ready. It never restarts by itself —
 * that could throw away a half-filled money entry.
 *
 * Expo reports progress as a fraction, not bytes, so this shows a percentage.
 */
export function UpdateStrip() {
  const { isDownloading, downloadProgress, isUpdatePending } = Updates.useUpdates();

  if (isUpdatePending) {
    return (
      <View style={[styles.strip, styles.ready]}>
        <View style={{ flex: 1 }}>
          <T variant="bodyBold" style={{ color: colors.siteInk }}>
            {t.settings.updateReady}
          </T>
          <T variant="small" style={{ color: colors.siteInk }}>
            {t.update.readyHelp}
          </T>
        </View>
        <Pressable accessibilityRole="button" onPress={() => Updates.reloadAsync()} style={styles.restart}>
          <T variant="bodyBold" style={{ color: colors.white }}>
            {t.settings.restart}
          </T>
        </Pressable>
      </View>
    );
  }

  if (isDownloading) {
    const pct = Math.round((downloadProgress ?? 0) * 100);
    return (
      <View style={styles.strip}>
        <T variant="small" style={{ flex: 1, color: colors.white }}>
          {t.update.downloading}
        </T>
        <Num bold style={{ color: colors.site }}>{`${pct}%`}</Num>
        {/* The bar along the header's bottom edge, in the site-board yellow. */}
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%` }]} />
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.xs,
    paddingBottom: space.sm + 4,
    backgroundColor: colors.brand,
  },
  ready: { backgroundColor: colors.site, paddingBottom: space.sm },
  restart: {
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.siteInk,
    paddingHorizontal: space.lg,
  },
  track: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  fill: { height: 4, backgroundColor: colors.site },
});
