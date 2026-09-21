import {
  ACCENT_KEYS,
  DEFAULT_ACCENT,
  DEFAULT_PRESET,
  THEME_PRESETS,
  type AccentKey,
  type ThemePreset,
} from '../../theme/colors';
import { normalizeAvatar, type AvatarStyle } from '../avatar/style';
import { DEFAULT_PRICED_APPS } from './prices';

/**
 * Kostenlos gibt es die ganze App im Standard-Aussehen. Mit einem Abo
 * irgendeiner Better-App (mit Preis) laesst sich alles personalisieren — das
 * Aussehen gilt ohnehin in allen Apps. Hell oder dunkel bleibt immer frei.
 *
 * Gespeichertes wird nie geloescht: ohne Abo liest die App hier den Standard,
 * mit Abo kommt die eigene Wahl zurueck. Rein und ohne React — getestet.
 */

/**
 * Was ohne Abo gesperrt ist. Dieselbe Liste steht im Dienst
 * (`services/api/billing/entitlement.js`), der es beim Schreiben durchsetzt.
 */
export const LOCKED_FIELDS = [
  'accentKey',
  'themePreset',
  'backdrop',
  'assistantAvatar',
  'assistantName',
  'assistantVoice',
] as const;

export type ThemeMode = 'light' | 'dark' | 'system';

/** Das Aussehen und der Assistent, wie sie gerade gelten. */
export type Personalization = Readonly<{
  /** Ob das Konto personalisieren darf. */
  canPersonalize: boolean;
  mode: ThemeMode;
  accent: AccentKey;
  preset: ThemePreset;
  /** `undefined` heisst: das Bild der App. */
  backdrop: string | undefined;
  avatar: AvatarStyle;
  /** `undefined` heisst: die beste Stimme spricht. */
  voice: string | undefined;
  /** Leer heisst: ohne Namen. */
  assistantName: string;
}>;

type PersonalFields = Readonly<{
  themeMode?: string;
  accentKey?: string;
  themePreset?: string;
  backdrop?: string;
  assistantAvatar?: unknown;
  assistantVoice?: string;
  assistantName?: string;
  paidApps?: readonly string[];
}>;

/** Ein Abo irgendeiner App mit Preis genuegt. BetterMoney hat noch keinen und schaltet nichts frei. */
export function canPersonalize(
  account: Readonly<{ paidApps?: readonly string[] }> | null | undefined,
  pricedApps: readonly string[] = DEFAULT_PRICED_APPS,
): boolean {
  return account?.paidApps?.some((app) => pricedApps.includes(app)) ?? false;
}

function modeOf(value: string | undefined): ThemeMode {
  return value === 'dark' || value === 'system' ? value : 'light';
}

function accentOf(value: string | undefined): AccentKey {
  return ACCENT_KEYS.includes(value as AccentKey) ? (value as AccentKey) : DEFAULT_ACCENT;
}

function presetOf(value: string | undefined): ThemePreset {
  return THEME_PRESETS.includes(value as ThemePreset) ? (value as ThemePreset) : DEFAULT_PRESET;
}

/**
 * Was gilt: mit Abo die eigene Wahl (tolerant gelesen), ohne Abo der Standard —
 * nur der Modus bleibt, wie er gewaehlt ist.
 */
export function effectivePersonalization(
  account: PersonalFields | null | undefined,
  pricedApps: readonly string[] = DEFAULT_PRICED_APPS,
): Personalization {
  const mode = modeOf(account?.themeMode);
  if (!canPersonalize(account, pricedApps)) {
    return {
      canPersonalize: false,
      mode,
      accent: DEFAULT_ACCENT,
      preset: DEFAULT_PRESET,
      backdrop: undefined,
      avatar: normalizeAvatar(undefined),
      voice: undefined,
      assistantName: '',
    };
  }
  return {
    canPersonalize: true,
    mode,
    accent: accentOf(account?.accentKey),
    preset: presetOf(account?.themePreset),
    backdrop: account?.backdrop || undefined,
    avatar: normalizeAvatar(account?.assistantAvatar),
    voice: account?.assistantVoice || undefined,
    assistantName: account?.assistantName?.trim() ?? '',
  };
}
