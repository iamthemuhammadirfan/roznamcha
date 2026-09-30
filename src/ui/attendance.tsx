import { t } from '@/i18n';
import type { DayStatus } from '@/lib/attendance';

import { Row } from './controls';
import { Num, T } from './text';
import { colors } from './theme';

export const STATUS_STYLE: Record<DayStatus, { fg: string; bg: string }> = {
  full: { fg: colors.owed, bg: colors.owedSoft },
  half: { fg: colors.pending, bg: colors.pendingSoft },
  absent: { fg: colors.recover, bg: colors.recoverSoft },
};

export function statusLabel(s: DayStatus): string {
  return t.attendance[s];
}

/** "12 پورا دن" — a count beside its label, coloured by status. */
export function StatusCount({ status, n }: { status: DayStatus; n: number }) {
  const { fg } = STATUS_STYLE[status];
  return (
    <Row>
      <Num bold style={{ fontSize: 20, color: fg }}>
        {n}
      </Num>
      <T variant="small" style={{ color: fg }}>
        {statusLabel(status)}
      </T>
    </Row>
  );
}
