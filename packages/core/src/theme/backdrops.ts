import type { ImageSourcePropType } from 'react-native';

import type { AppId } from '@/app/identity';
import { serviceUrl } from '@/db/service';
import type { TranslationKey } from '@/i18n';

/**
 * Die Hintergruende. Am Konto steht `backdrop`:
 *
 * - fehlt es oder steht es auf `app`, zeigt jede App ihr eigenes Bild
 * - ein Schluessel aus `BACKDROPS` — eines der Bilder aus scripts/backdrops.js
 * - `upload:<id>` — ein eigenes Bild, das beim Dienst liegt
 *
 * Weil der Wert am Konto haengt, sieht jede Better-App denselben Hintergrund.
 */

/** Das Bild jeder App: unten angesetzt, nach oben durchsichtig auslaufend. */
export const APP_BACKDROPS: Readonly<Record<AppId, ImageSourcePropType>> = {
  getbetter: require('../assets/backgrounds/getbetter-life.png'),
  betterfamily: require('../assets/backgrounds/betterfamily-life.png'),
  bettergym: require('../assets/backgrounds/bettergym-life.png'),
  betterai: require('../assets/backgrounds/betterai-life.png'),
  bettermoney: require('../assets/backgrounds/bettermoney-life.png'),
};

/** Ob ein Bild selbst hell oder dunkel ist — davon haengt ab, wie viel Papier darueber muss. */
export type BackdropTone = 'light' | 'dark';

export type BackdropPreset = {
  labelKey: TranslationKey;
  tone: BackdropTone;
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
    source: require('../assets/backgrounds/mist.jpg'),
    thumb: require('../assets/backgrounds/mist-thumb.jpg'),
  },
  lake: {
    labelKey: 'personalize.backdrop.lake',
    tone: 'light',
    source: require('../assets/backgrounds/lake.jpg'),
    thumb: require('../assets/backgrounds/lake-thumb.jpg'),
  },
  forest: {
    labelKey: 'personalize.backdrop.forest',
    tone: 'light',
    source: require('../assets/backgrounds/forest.jpg'),
    thumb: require('../assets/backgrounds/forest-thumb.jpg'),
  },
  dunes: {
    labelKey: 'personalize.backdrop.dunes',
    tone: 'light',
    source: require('../assets/backgrounds/dunes.jpg'),
    thumb: require('../assets/backgrounds/dunes-thumb.jpg'),
  },
  snow: {
    labelKey: 'personalize.backdrop.snow',
    tone: 'light',
    source: require('../assets/backgrounds/snow.jpg'),
    thumb: require('../assets/backgrounds/snow-thumb.jpg'),
  },
  bloom: {
    labelKey: 'personalize.backdrop.bloom',
    tone: 'light',
    source: require('../assets/backgrounds/bloom.jpg'),
    thumb: require('../assets/backgrounds/bloom-thumb.jpg'),
  },
  paper: {
    labelKey: 'personalize.backdrop.paper',
    tone: 'light',
    source: require('../assets/backgrounds/paper.jpg'),
    thumb: require('../assets/backgrounds/paper-thumb.jpg'),
  },
  dusk: {
    labelKey: 'personalize.backdrop.dusk',
    tone: 'dark',
    source: require('../assets/backgrounds/dusk.jpg'),
    thumb: require('../assets/backgrounds/dusk-thumb.jpg'),
  },
  moon: {
    labelKey: 'personalize.backdrop.moon',
    tone: 'dark',
    source: require('../assets/backgrounds/moon.jpg'),
    thumb: require('../assets/backgrounds/moon-thumb.jpg'),
  },
  aurora: {
    labelKey: 'personalize.backdrop.aurora',
    tone: 'dark',
    source: require('../assets/backgrounds/aurora.jpg'),
    thumb: require('../assets/backgrounds/aurora-thumb.jpg'),
  },
  night: {
    labelKey: 'personalize.backdrop.night',
    tone: 'dark',
    source: require('../assets/backgrounds/night.jpg'),
    thumb: require('../assets/backgrounds/night-thumb.jpg'),
  },
  ink: {
    labelKey: 'personalize.backdrop.ink',
    tone: 'dark',
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
  | { kind: 'preset'; key: BackdropKey; tone: BackdropTone; source: ImageSourcePropType }
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
    return { kind: 'preset', key: backdrop, tone: preset.tone, source: preset.source };
  }
  const id = uploadIdOf(backdrop);
  if (id) return { kind: 'upload', id, source: uploadSource(id) };
  return { kind: 'app', source: APP_BACKDROPS[appId] };
}

export function backdropSource(
  backdrop: string | null | undefined,
  appId: AppId,
): ImageSourcePropType {
  return resolveBackdrop(backdrop, appId).source;
}
