import type { AppId } from '../../app/identity';
import type { TranslationKey } from '../../i18n/de';

/**
 * Die Beispiele unter dem Feld: jedes Mal andere, und nur zu den Apps, in denen
 * das Konto schon war. Rein gerechnet — aus einem Startwert kommt immer
 * dieselbe Auswahl, darum laesst es sich testen.
 *
 * Im Vorrat steht nur, was wirklich ankommt: zwei Auftraege (Einkauf und
 * Aemtli) und sonst Fragen, die die KI ohne eigene Daten beantworten kann.
 * Nichts, was so tut, als kenne er den Kalender.
 */
const POOL: Readonly<Record<AppId, readonly TranslationKey[]>> = {
  getbetter: [
    'assistant.chip.plan',
    'assistant.chip.note',
    'assistant.chip.mailReply',
    'assistant.chip.gift',
  ],
  betterfamily: [
    'assistant.chip.shopping',
    'assistant.chip.chore',
    'assistant.chip.dinner',
    'assistant.chip.plants',
  ],
  bettergym: ['assistant.chip.workout', 'assistant.chip.water', 'assistant.chip.sleep'],
  betterai: ['assistant.chip.explain', 'assistant.chip.idea'],
  bettermoney: ['assistant.chip.save', 'assistant.chip.budget'],
};

/**
 * Beispiele, die etwas eintragen: nur in Apps, deren KI das auch kann
 * (`add_shopping`, `add_chore` in `services/api/ai/tools.js`).
 */
const ACTION_APPS: Partial<Record<TranslationKey, readonly AppId[]>> = {
  'assistant.chip.shopping': ['getbetter', 'betterfamily'],
  'assistant.chip.chore': ['getbetter', 'betterfamily'],
};

/** So viele Beispiele stehen da — mehr wird die Zeile unter dem Feld zu voll. */
export const SUGGESTION_COUNT = 3;

// Am Vorrat selbst geprueft: so bleibt die Datei rein und laeuft unter Node.
const isAppId = (value: string): value is AppId => Object.hasOwn(POOL, value);

/**
 * Ein Startwert aus Text, ohne Zufall: dasselbe Konto sieht beim Öffnen
 * dieselben Beispiele, nach jeder Frage die naechsten.
 */
export function seedOf(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 16777619);
  }
  return Math.abs(hash % 100000) / 100000;
}

/** Aus dem Startwert eine Folge von Zahlen: immer dieselbe, aber gut gemischt. */
function stepOf(seed: number): () => number {
  let value = Math.floor(Math.abs(seed) * 2 ** 31) % 2147483647 || 1;
  return () => {
    value = (value * 48271) % 2147483647;
    return value / 2147483647;
  };
}

/**
 * Der Vorrat zu diesen Apps, immer mit der laufenden App dabei. Kennt das Konto
 * noch keine App, bleibt es bei der laufenden.
 */
export function poolFor(current: AppId, seen: readonly string[]): readonly TranslationKey[] {
  const apps = [current, ...seen.filter((app): app is AppId => isAppId(app) && app !== current)];
  return apps.flatMap((app) => POOL[app]).filter((key) => ACTION_APPS[key]?.includes(current) ?? true);
}

/**
 * `count` Beispiele aus dem Vorrat, ohne Wiederholung. Derselbe `seed` gibt
 * dieselbe Auswahl — die App wuerfelt nach jeder Frage einen neuen.
 */
export function suggestionsFor({
  current,
  seen,
  seed,
  count = SUGGESTION_COUNT,
}: {
  current: AppId;
  seen: readonly string[];
  seed: number;
  count?: number;
}): readonly TranslationKey[] {
  const pool = [...poolFor(current, seen)];
  const next = stepOf(seed);
  const picked: TranslationKey[] = [];
  while (pool.length > 0 && picked.length < count) {
    const [taken] = pool.splice(Math.floor(next() * pool.length), 1);
    if (taken) picked.push(taken);
  }
  return picked;
}
