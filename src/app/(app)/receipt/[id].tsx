import { Directory, File, Paths } from 'expo-file-system';
import { router, useLocalSearchParams } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useRef, useState } from 'react';
import { Alert, Linking, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';

import { useReceiptData } from '@/db/hooks';
import { stampReceiptSent } from '@/db/mutations';
import { balanceLabel } from '@/ui/balance-chip';
import { formatDayUr } from '@/lib/dates';
import { formatRupees, toWhatsAppNumber } from '@/lib/money';
import { useMember } from '@/state/session';
import { entryKindLabel, t } from '@/i18n';
import { ur } from '@/strings.ur';
import { Banner, Button, Empty, Screen } from '@/ui/controls';
import { Parchi, type ParchiData } from '@/ui/parchi';
import { T } from '@/ui/text';
import { colors } from '@/ui/theme';

/** Cached next to the ledger entry so a disputed slip can be re-sent byte-for-byte. */
async function savePng(tmpUri: string, refCode: string) {
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ intermediates: true });
  const dest = new File(dir, `${refCode}.png`);
  await new File(tmpUri).copy(dest, { overwrite: true });
  return dest.uri;
}

/** The text that goes with the parchi image — Urdu, like the parchi, whatever the app language. */
function oneLineText(d: ParchiData) {
  const bal = balanceLabel(d.balancePaisa, ur);
  const balText = d.balancePaisa === 0 ? bal.label : `${bal.label} ${formatRupees(d.balancePaisa)} ${ur.common.rupees}`;
  return `${d.businessName}\n${d.workerName} — ${formatDayUr(d.date)}\n${entryKindLabel(d.kind, ur)}: ${formatRupees(d.amountPaisa)} ${ur.common.rupees}\n${ur.balance.newBalance}: ${balText}\n${ur.receipt.ref}: ${d.refCode}`;
}

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { businessName } = useMember();
  const { entry, balance } = useReceiptData(id);
  const slip = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  if (!entry) return <Empty text={t.ledger.empty} />;

  const data: ParchiData = {
    businessName,
    workerName: entry.worker_name,
    fatherName: entry.worker_father_name,
    projectCode: entry.project_code,
    projectName: entry.project_name,
    date: entry.date,
    kind: entry.kind,
    amountPaisa: entry.amount_paisa,
    note: entry.kind === 'correction' ? `${ur.entry.reverses} ${entry.note_ur ?? ''}` : entry.note_ur,
    balancePaisa: balance,
    refCode: entry.ref_code,
  };

  async function sendImage() {
    if (!(await Sharing.isAvailableAsync())) return Alert.alert(t.receipt.shareUnavailable);
    setBusy(true);
    try {
      const tmp = await captureRef(slip, { format: 'png', quality: 1, result: 'tmpfile' });
      const uri = await savePng(tmp, entry!.ref_code);
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t.receipt.send });
      await stampReceiptSent(entry!.id);
    } catch (e) {
      Alert.alert(t.common.error, String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendText() {
    const number = toWhatsAppNumber(entry!.worker_phone);
    if (!number) return Alert.alert(t.receipt.noPhone);
    await Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(oneLineText(data))}`);
  }

  return (
    <Screen>
      {!entry.receipt_sent_at ? <Banner text={t.receipt.sendNow} /> : <Banner tone="brand" text={t.receipt.sent} />}
      <View style={{ alignItems: 'center' }}>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
          <Parchi ref={slip} data={data} />
        </View>
      </View>
      <Button label={t.receipt.send} onPress={sendImage} busy={busy} style={{ minHeight: 72 }} />
      <Button label={t.receipt.sendText} kind="secondary" onPress={sendText} />
      <Button label={t.receipt.done} kind="secondary" onPress={() => router.back()} />
      <T variant="small" style={{ textAlign: 'center' }}>
        {t.receipt.ref} {entry.ref_code}
      </T>
    </Screen>
  );
}
