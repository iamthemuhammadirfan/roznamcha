export const colors = {
  brand: '#1F3A2E',
  brandSoft: '#E7EFEA',
  bg: '#F6F4EF',
  card: '#FFFFFF',
  text: '#1B1B1B',
  muted: '#5F6368',
  border: '#DAD6CC',
  owed: '#1B7F3B', // we owe the worker
  owedSoft: '#E3F3E7',
  recover: '#B3261E', // worker owes us
  recoverSoft: '#FBE7E5',
  pending: '#B26A00',
  pendingSoft: '#FFF1DB',
  white: '#FFFFFF',
};

export const fonts = {
  // Urdu UI text. Nastaliq needs roughly double the line height of Latin text, or the
  // descenders clip — the text styles below are sized for it.
  urdu: 'JameelNooriNastaleeq',
  // Latin digits in Urdu mode: Naskh's digits are cleaner at small sizes than Nastaliq's.
  digits: 'NotoNaskhArabic_400Regular',
  digitsBold: 'NotoNaskhArabic_700Bold',
  // English UI uses the platform font (undefined = system default).
  latin: undefined as string | undefined,
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

/** Rows a munshi taps with dusty hands in sunlight. */
export const TOUCH_MIN = 64;
