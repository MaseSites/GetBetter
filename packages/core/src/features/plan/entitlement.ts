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

/**
 * Die Anprobe beim Einrichten: ohne Abo darf man alles ausprobieren und sieht
 * es sofort in der ganzen App — gespeichert wird davon nichts (der Dienst
 * wiese es ohne Abo ab). Nur, was man angefasst hat, steht darin.
 */
export type Trial = Readonly<{
  accent?: AccentKey;
  preset?: ThemePreset;
  /** `null` heisst: das Bild der App. */
  backdrop?: string | null;
  avatar?: AvatarStyle;
  assistantName?: string;
}>;

/**
 * Was gilt, mit der Anprobe darueber. Solange sie laeuft, ist alles waehlbar
 * (`canPersonalize`), damit die Auswahlen offen stehen statt mit Schloss.
 */
export function withTrial(personal: Personalization, trial: Trial | null): Personalization {
  if (!trial) return personal;
  return {
    ...personal,
    canPersonalize: true,
    ...(trial.accent ? { accent: trial.accent } : {}),
    ...(trial.preset ? { preset: trial.preset } : {}),
    ...(trial.backdrop === undefined ? {} : { backdrop: trial.backdrop ?? undefined }),
    ...(trial.avatar ? { avatar: normalizeAvatar(trial.avatar) } : {}),
    ...(trial.assistantName === undefined ? {} : { assistantName: trial.assistantName.trim() }),
  };
}

/** Ob die Anprobe etwas enthaelt, das es nur mit Abo gibt — dann geht es ohne nicht weiter. */
export function trialNeedsPlan(trial: Trial | null): boolean {
  if (!trial) return false;
  const standard = effectivePersonalization(null);
  const tried = withTrial(standard, trial);
  return (
    tried.accent !== standard.accent ||
    tried.preset !== standard.preset ||
    tried.backdrop !== standard.backdrop ||
    tried.assistantName !== standard.assistantName ||
    JSON.stringify(tried.avatar) !== JSON.stringify(standard.avatar)
  );
}
