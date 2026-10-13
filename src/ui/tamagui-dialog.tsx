// A confirm / choose dialog for the Settings screens, in place of the platform alert:
// large stacked buttons a dusty thumb can't miss, the app's own fonts (Urdu included),
// and a short spring in on the UI thread. Built with Tamagui (Settings only).
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { AlertDialog } from '@tamagui/alert-dialog';

import { YStack } from './tamagui.config';
import { Text } from './tamagui-text';
import { colors, TOUCH_MIN } from './theme';

export interface DialogAction {
  label: string;
  onPress: () => void;
  /** `danger` for what can't be taken back; `current` marks the choice already in effect. */
  tone?: 'brand' | 'danger' | 'current';
}

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
    <AlertDialog open={open} onOpenChange={(next) => !next && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          key="overlay"
          backgroundColor="rgba(15,30,23,0.62)"
          transition="quick"
          opacity={{ default: 1, enter: 0, exit: 0 }}
        />
        <AlertDialog.Content
          key="content"
          width="88%"
          maxWidth={420}
          backgroundColor="card"
          borderRadius="lg"
          padding="xl"
          gap="lg"
          transition="dialog"
          opacity={{ default: 1, enter: 0, exit: 0 }}
          scale={{ default: 1, enter: 0.94, exit: 0.97 }}
          y={{ default: 0, enter: 16, exit: 8 }}>
          <YStack gap="xs">
            <AlertDialog.Title>
              <Text variant="h2">{title}</Text>
            </AlertDialog.Title>
            {description ? (
              <AlertDialog.Description>
                <Text variant="small">{description}</Text>
              </AlertDialog.Description>
            ) : null}
          </YStack>

          <YStack gap="sm">
            {actions.map((a) => {
              const danger = a.tone === 'danger';
              const current = a.tone === 'current';
              return (
                <AlertDialog.Action
                  key={a.label}
                  onPress={a.onPress}
                  minHeight={TOUCH_MIN - 8}
                  borderRadius="md"
                  paddingHorizontal="lg"
                  flexDirection="row"
                  alignItems="center"
                  justifyContent="center"
                  gap="sm"
                  borderWidth={current ? 2 : 0}
                  borderColor="brand"
                  backgroundColor={
                    current
                      ? { default: 'brandSoft', press: 'border' }
                      : danger
                        ? { default: 'recover', press: 'siteInk' }
                        : { default: 'brand', press: 'siteInk' }
                  }>
                  {current ? <MaterialCommunityIcons name="check" size={20} color={colors.brand} /> : null}
                  <Text variant="bodyBold" color={current ? 'brand' : 'white'}>
                    {a.label}
                  </Text>
                </AlertDialog.Action>
              );
            })}
            <AlertDialog.Cancel
              minHeight={TOUCH_MIN - 8}
              borderRadius="md"
              alignItems="center"
              justifyContent="center"
              backgroundColor={{ default: 'transparent', press: 'brandSoft' }}>
              <Text variant="bodyBold" color="muted">
                {cancelLabel}
              </Text>
            </AlertDialog.Cancel>
          </YStack>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog>
  );
}
