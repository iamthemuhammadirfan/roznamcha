import { wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import { createConsoleLogger, LogLevels, PowerSyncDatabase } from '@powersync/react-native';

import { AppSchema, drizzleSchema } from './schema';

export const powersync = new PowerSyncDatabase({
  schema: AppSchema,
  database: { dbFilename: 'roznamcha.db' },
  // Info-level sync logs in development (Metro and `adb logcat`), warnings only in the APK.
  logger: createConsoleLogger({ minLevel: __DEV__ ? LogLevels.info : LogLevels.warn }),
});

export const db = wrapPowerSyncWithDrizzle(powersync, { schema: drizzleSchema });

// Surface sync failures in the Metro log; the Settings tab shows the same errors on the phone.
powersync.registerListener({
  statusChanged(status) {
    const err = status.dataFlowStatus.downloadError ?? status.dataFlowStatus.uploadError;
    if (err) console.warn('[sync]', err.message);
  },
});

export * from './schema';
