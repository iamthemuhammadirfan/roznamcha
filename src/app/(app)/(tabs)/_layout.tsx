import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { ur } from '@/strings.ur';
import { colors, fonts } from '@/ui/theme';

/**
 * The three places the munshi moves between: projects, all workers, settings. Everything else (worker ledger, new entry,
 * parchi, forms) is pushed on top by the parent stack, so back always returns here.
 */
export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.card}
      iconColor={{ default: colors.muted, selected: colors.brand }}
      labelStyle={{
        default: { fontFamily: fonts.naskh, fontSize: 13, color: colors.muted },
        selected: { fontFamily: fonts.naskhBold, fontSize: 13, color: colors.brand },
      }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf="house.fill" md="home" />
        <NativeTabs.Trigger.Label>{ur.nav.home}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="directory">
        <NativeTabs.Trigger.Icon sf="person.crop.rectangle.stack.fill" md="contacts" />
        <NativeTabs.Trigger.Label>{ur.nav.directory}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon sf="gearshape.fill" md="settings" />
        <NativeTabs.Trigger.Label>{ur.nav.settings}</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
