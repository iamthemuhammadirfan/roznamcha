// App language. Urdu is right-to-left and English left-to-right, and React Native
// only applies a direction change on restart — so the language is fixed for the life
// of the JS bundle. It is read synchronously from the native layout direction, which
// Android/iOS persist across launches, and the saved preference only exists to correct
// that direction on the very first launch.
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Updates from 'expo-updates';
import { DevSettings, I18nManager } from 'react-native';

import { en, type Strings } from './strings.en';
import { ur } from './strings.ur';

export type Lang = 'ur' | 'en';

const KEY = 'language';
const FLIP_KEY = 'language:flippedAt';
const DEFAULT: Lang = 'ur';

export const lang: Lang = I18nManager.isRTL ? 'ur' : 'en';
export const isUrdu = lang === 'ur';

/** Strings for the app UI in the current language. The parchi always uses `ur` directly. */
export const t: Strings = isUrdu ? ur : en;

async function restart() {
  if (__DEV__) DevSettings.reload();
  else await Updates.reloadAsync();
}

/**
 * Called once before the splash hides. Returns true if the direction had to be flipped
 * and the app is restarting (first launch on a phone whose system language disagrees
 * with the saved choice, or the default).
 */
export async function ensureDirection(): Promise<boolean> {
  const saved = ((await AsyncStorage.getItem(KEY)) as Lang | null) ?? DEFAULT;
  const wantRTL = saved === 'ur';
  I18nManager.allowRTL(true);
  if (I18nManager.isRTL === wantRTL) {
    await AsyncStorage.removeItem(FLIP_KEY);
    return false;
  }
  // Never loop: if we already restarted for this and the direction still didn't take
  // (native config overriding it), carry on in whatever direction we have.
  const lastFlip = Number((await AsyncStorage.getItem(FLIP_KEY)) ?? 0);
  if (Date.now() - lastFlip < 30_000) {
    console.warn('[i18n] layout direction did not change after restart; continuing without it');
    return false;
  }
  await AsyncStorage.setItem(FLIP_KEY, String(Date.now()));
  I18nManager.forceRTL(wantRTL);
  await restart();
  return true;
}

export async function setLanguage(next: Lang) {
  await AsyncStorage.setItem(KEY, next);
  await AsyncStorage.setItem(FLIP_KEY, String(Date.now()));
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(next === 'ur');
  await restart();
}

const ENTRY_KINDS = ['advance', 'payment', 'deduction', 'bonus', 'correction'] as const;

export function entryKindLabel(kind: string, s: Strings = t): string {
  return (ENTRY_KINDS as readonly string[]).includes(kind) ? s.entry[kind as (typeof ENTRY_KINDS)[number]] : kind;
}

// Trades are stored in the database as their Urdu word, so existing rows and both
// languages agree; English only changes how they're shown.
const TRADE_KEYS = ['mason', 'labourer', 'carpenter', 'steelFixer', 'electrician', 'plumber', 'painter'] as const;

/** The stored value for each trade (the Urdu word). */
export const tradeOptions: string[] = TRADE_KEYS.map((k) => ur.trade[k]);

export function tradeLabel(stored: string | null | undefined): string {
  if (!stored) return '';
  const key = TRADE_KEYS.find((k) => ur.trade[k] === stored);
  return key ? t.trade[key] : stored;
}
