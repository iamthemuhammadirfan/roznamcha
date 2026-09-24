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
import { entryKindLabel, ur } from '@/strings.ur';
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

function oneLineText(d: ParchiData) {
  const bal = balanceLabel(d.balancePaisa);
  const balText = d.balancePaisa === 0 ? bal.label : `${bal.label} ${formatRupees(d.balancePaisa)} ${ur.common.rupees}`;
  return `${d.businessName}\n${d.workerName} — ${formatDayUr(d.date)}\n${entryKindLabel[d.kind]}: ${formatRupees(d.amountPaisa)} ${ur.common.rupees}\n${ur.balance.newBalance}: ${balText}\n${ur.receipt.ref}: ${d.refCode}`;
}

export default function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { businessName } = useMember();
  const { entry, balance } = useReceiptData(id);
  const slip = useRef<View>(null);
  const [busy, setBusy] = useState(false);

  if (!entry) return <Empty text={ur.ledger.empty} />;

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
    if (!(await Sharing.isAvailableAsync())) return Alert.alert(ur.receipt.shareUnavailable);
    setBusy(true);
    try {
      const tmp = await captureRef(slip, { format: 'png', quality: 1, result: 'tmpfile' });
      const uri = await savePng(tmp, entry!.ref_code);
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: ur.receipt.send });
      await stampReceiptSent(entry!.id);
    } catch (e) {
      Alert.alert(ur.common.error, String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sendText() {
    const number = toWhatsAppNumber(entry!.worker_phone);
    if (!number) return Alert.alert(ur.receipt.noPhone);
    await Linking.openURL(`https://wa.me/${number}?text=${encodeURIComponent(oneLineText(data))}`);
  }

  return (
    <Screen>
      {!entry.receipt_sent_at ? <Banner text={ur.receipt.sendNow} /> : <Banner tone="brand" text={ur.receipt.sent} />}
      <View style={{ alignItems: 'center' }}>
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12 }}>
          <Parchi ref={slip} data={data} />
        </View>
      </View>
      <Button label={ur.receipt.send} onPress={sendImage} busy={busy} style={{ minHeight: 72 }} />
      <Button label={ur.receipt.sendText} kind="secondary" onPress={sendText} />
      <Button label={ur.receipt.done} kind="secondary" onPress={() => router.back()} />
      <T variant="small" style={{ textAlign: 'center' }}>
        {ur.receipt.ref} {entry.ref_code}
      </T>
    </Screen>
  );
}
