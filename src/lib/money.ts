// Money is always integer paisa. Rupees only exist at the edges: parsing input and display.

export function formatRupees(paisa: number): string {
  const abs = Math.abs(paisa);
  const rupees = Math.floor(abs / 100);
  const rem = abs % 100;
  const whole = rupees.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return rem === 0 ? whole : `${whole}.${rem.toString().padStart(2, '0')}`;
}

/** Parses what the munshi typed ("5000", "5,000", "1200.50") into paisa. Returns null if not a positive amount. */
export function parseRupees(input: string): number | null {
  const cleaned = input.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, frac = ''] = cleaned.split('.');
  const paisa = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(paisa) ? paisa : null;
}

/** Local mobile number → the international form WhatsApp wants (03001234567 → 923001234567). */
export function toWhatsAppNumber(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length === 12) return digits;
  if (digits.startsWith('0') && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith('3')) return `92${digits}`;
  return null;
}

export function normalizePhone(phone: string): string {
  return toWhatsAppNumber(phone) ?? phone.replace(/\D/g, '');
}
