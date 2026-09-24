// Parchi reference codes, minted offline on the phone: R-2026-7KQ4MX.
// Six characters from an alphabet without 0/O/1/I keeps collisions negligible across
// two phones and keeps the code easy to read aloud over the phone.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeRefCode(year: number, randomBytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < 6; i++) s += ALPHABET[randomBytes[i] % ALPHABET.length];
  return `R-${year}-${s}`;
}
