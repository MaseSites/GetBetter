import type { ImageSourcePropType } from 'react-native';

import type { AppId } from '@/app/identity';
import { serviceUrl } from '@/db/service';
import type { TranslationKey } from '@/i18n';

import type { ColorScheme } from './colors';

/**
 * Die Hintergruende. Am Konto steht `backdrop`:
 *
 * - fehlt es oder steht es auf `app`, zeigt jede App ihr eigenes Bild
 * - ein Schluessel aus `BACKDROPS` — eines der Bilder aus scripts/backdrops.js
 * - `upload:<id>` — ein eigenes Bild, das beim Dienst liegt
 *
 * Weil der Wert am Konto haengt, sieht jede Better-App denselben Hintergrund.
 */

/**
 * Wie viel Papier ueber einem Bild liegt, an fuenf Hoehen von oben nach unten
 * (`VEIL_STOPS`). Die Werte sind gemessen, nicht geschaetzt: an den dunkelsten
 * (hell) bzw. hellsten (dunkel) 2 % der Bildpunkte jeder Hoehe erreicht ruhige
 * Schrift (`textMuted`) 4.5:1 und zarte (`textFaint`) 3:1 — ueberall, denn der
 * Inhalt rollt ueber das stehende Bild. Wer ein Bild tauscht, misst neu.
 */
export type Veil = readonly [number, number, number, number, number];
export const VEIL_STOPS = [0, 0.25, 0.5, 0.75, 1] as const;

/** Das Bild jeder App: unten angesetzt, nach oben durchsichtig auslaufend. */
export const APP_BACKDROPS: Readonly<Record<AppId, ImageSourcePropType>> = {
  getbetter: require('../assets/backgrounds/getbetter-life.png'),
  betterfamily: require('../assets/backgrounds/betterfamily-life.png'),
  bettergym: require('../assets/backgrounds/bettergym-life.png'),
  betterai: require('../assets/backgrounds/betterai-life.png'),
  bettermoney: require('../assets/backgrounds/bettermoney-life.png'),
};

/** Papier ueber dem Bild einer App — nur ueber dessen Hoehe, nicht ueber dem ganzen Bildschirm. */
export const APP_BACKDROP_VEILS: Readonly<Record<AppId, Readonly<Record<ColorScheme, Veil>>>> = {
  getbetter: { light: [0, 0.28, 0.32, 0.74, 0.74], dark: [0, 0.12, 0.42, 0.42, 0.42] },
  betterfamily: { light: [0, 0, 0.1, 0.42, 0.42], dark: [0, 0, 0, 0.16, 0.16] },
  bettergym: { light: [0, 0, 0.1, 0.38, 0.38], dark: [0, 0, 0, 0, 0] },
  betterai: { light: [0, 0, 0, 0.16, 0.16], dark: [0, 0, 0, 0, 0] },
  bettermoney: { light: [0, 0, 0, 0.32, 0.32], dark: [0, 0, 0.16, 0.42, 0.42] },
};

/** Passt ein Bild nicht zum Modus, deckt das Papier fast zu — sonst stuende dunkle Schrift auf dunklem Grund. */
export const MISMATCH_VEIL: Veil = [0.9, 0.88, 0.88, 0.88, 0.88];

/** Eigene Bilder kennt die App nicht; sie bekommen so viel Papier wie das schwierigste der eigenen. */
export const UPLOAD_VEIL: Veil = [0.88, 0.88, 0.88, 0.88, 0.88];

/** Ob ein Bild selbst hell oder dunkel ist — davon haengt ab, wie viel Papier darueber muss. */
export type BackdropTone = 'light' | 'dark';

export type BackdropPreset = {
  labelKey: TranslationKey;
  tone: BackdropTone;
  /**
   * Papier, wenn das Bild zum Modus passt. Oben immer viel — dort stehen Titel
   * direkt auf dem Bild —, darunter so viel, wie das Bild verlangt.
   */
  veil: Veil;
  /** 1080 × 1920, fuer den ganzen Bildschirm. */
  source: ImageSourcePropType;
  /** Kleine Fassung fuer die Auswahl. */
  thumb: ImageSourcePropType;
};

/** Erzeugt von scripts/backdrops.js — Reihenfolge wie in der Auswahl. */
export const BACKDROPS = {
  mist: {
    labelKey: 'personalize.backdrop.mist',
    tone: 'light',
    veil: [0.8, 0.64, 0.54, 0.68, 0.68],
    source: require('../assets/backgrounds/mist.jpg'),
    thumb: require('../assets/backgrounds/mist-thumb.jpg'),
  },
  lake: {
    labelKey: 'personalize.backdrop.lake',
    tone: 'light',
    veil: [0.8, 0.64, 0.54, 0.54, 0.22],
    source: require('../assets/backgrounds/lake.jpg'),
    thumb: require('../assets/backgrounds/lake-thumb.jpg'),
  },
  forest: {
    labelKey: 'personalize.backdrop.forest',
    tone: 'light',
    veil: [0.8, 0.64, 0.7, 0.7, 0.7],
    source: require('../assets/backgrounds/forest.jpg'),
    thumb: require('../assets/backgrounds/forest-thumb.jpg'),
  },
  dunes: {
    labelKey: 'personalize.backdrop.dunes',
    tone: 'light',
    veil: [0.8, 0.64, 0.48, 0.58, 0.58],
    source: require('../assets/backgrounds/dunes.jpg'),
    thumb: require('../assets/backgrounds/dunes-thumb.jpg'),
  },
  snow: {
    labelKey: 'personalize.backdrop.snow',
    tone: 'light',
    veil: [0.8, 0.64, 0.48, 0.36, 0.22],
    source: require('../assets/backgrounds/snow.jpg'),
    thumb: require('../assets/backgrounds/snow-thumb.jpg'),
  },
  bloom: {
    labelKey: 'personalize.backdrop.bloom',
    tone: 'light',
    veil: [0.8, 0.64, 0.48, 0.36, 0.22],
    source: require('../assets/backgrounds/bloom.jpg'),
    thumb: require('../assets/backgrounds/bloom-thumb.jpg'),
  },
  paper: {
    labelKey: 'personalize.backdrop.paper',
    tone: 'light',
    veil: [0.8, 0.64, 0.48, 0.36, 0.22],
    source: require('../assets/backgrounds/paper.jpg'),
    thumb: require('../assets/backgrounds/paper-thumb.jpg'),
  },
  dusk: {
    labelKey: 'personalize.backdrop.dusk',
    tone: 'dark',
    veil: [0.8, 0.64, 0.8, 0.8, 0.4],
    source: require('../assets/backgrounds/dusk.jpg'),
    thumb: require('../assets/backgrounds/dusk-thumb.jpg'),
  },
  moon: {
    labelKey: 'personalize.backdrop.moon',
    tone: 'dark',
    veil: [0.8, 0.86, 0.86, 0.36, 0.22],
    source: require('../assets/backgrounds/moon.jpg'),
    thumb: require('../assets/backgrounds/moon-thumb.jpg'),
  },
  aurora: {
    labelKey: 'personalize.backdrop.aurora',
    tone: 'dark',
    veil: [0.8, 0.64, 0.6, 0.36, 0.22],
    source: require('../assets/backgrounds/aurora.jpg'),
    thumb: require('../assets/backgrounds/aurora-thumb.jpg'),
  },
  night: {
    labelKey: 'personalize.backdrop.night',
    tone: 'dark',
    veil: [0.8, 0.64, 0.48, 0.36, 0.22],
    source: require('../assets/backgrounds/night.jpg'),
    thumb: require('../assets/backgrounds/night-thumb.jpg'),
  },
  ink: {
    labelKey: 'personalize.backdrop.ink',
    tone: 'dark',
    veil: [0.8, 0.64, 0.48, 0.36, 0.22],
    source: require('../assets/backgrounds/ink.jpg'),
    thumb: require('../assets/backgrounds/ink-thumb.jpg'),
  },
} as const satisfies Record<string, BackdropPreset>;

export type BackdropKey = keyof typeof BACKDROPS;

export const BACKDROP_KEYS = Object.keys(BACKDROPS) as readonly BackdropKey[];

/** Der Wert fuer „jede App ihr eigenes Bild“. */
export const APP_BACKDROP = 'app';

/** Davor steht die Id eines hochgeladenen Bildes. */
export const UPLOAD_PREFIX = 'upload:';

export type ResolvedBackdrop =
  | { kind: 'app'; source: ImageSourcePropType }
  | {
      kind: 'preset';
      key: BackdropKey;
      tone: BackdropTone;
      veil: Veil;
      source: ImageSourcePropType;
    }
  | { kind: 'upload'; id: string; source: ImageSourcePropType };

export function isBackdropKey(value: string): value is BackdropKey {
  return Object.prototype.hasOwnProperty.call(BACKDROPS, value);
}

/** Ids, wie sie der Dienst vergibt — nichts, was aus dem Pfad ausbrechen koennte. */
const UPLOAD_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

export function isUploadId(value: string): boolean {
  return UPLOAD_ID.test(value);
}

/** Die Id eines eigenen Bildes, oder null, wenn `backdrop` keines meint. */
export function uploadIdOf(backdrop: string | null | undefined): string | null {
  if (!backdrop?.startsWith(UPLOAD_PREFIX)) return null;
  const id = backdrop.slice(UPLOAD_PREFIX.length);
  return isUploadId(id) ? id : null;
}

export function uploadSource(id: string): ImageSourcePropType {
  return { uri: `${serviceUrl()}/v1/uploads/${encodeURIComponent(id)}` };
}

/**
 * Was `backdrop` meint. Unbekannte Schluessel — etwa ein Bild, das es nicht
 * mehr gibt — fallen auf das Bild der App zurueck, nie auf eine leere Flaeche.
 */
export function resolveBackdrop(
  backdrop: string | null | undefined,
  appId: AppId,
): ResolvedBackdrop {
  if (backdrop && isBackdropKey(backdrop)) {
    const preset = BACKDROPS[backdrop];
    return {
      kind: 'preset',
      key: backdrop,
      tone: preset.tone,
      veil: preset.veil,
      source: preset.source,
    };
  }
  const id = uploadIdOf(backdrop);
  if (id) return { kind: 'upload', id, source: uploadSource(id) };
  return { kind: 'app', source: APP_BACKDROPS[appId] };
}

/** Das Papier ueber einem gewaehlten Bild: passend, unpassend oder eigenes. */
export function veilOf(
  backdrop: Exclude<ResolvedBackdrop, { kind: 'app' }>,
  scheme: ColorScheme,
): Veil {
  if (backdrop.kind === 'upload') return UPLOAD_VEIL;
  return backdrop.tone === scheme ? backdrop.veil : MISMATCH_VEIL;
}

export function backdropSource(
  backdrop: string | null | undefined,
  appId: AppId,
): ImageSourcePropType {
  return resolveBackdrop(backdrop, appId).source;
}
