import type { AiAction, AiContextItem } from '../../db/ai';
import { commandOf, dayIn } from './understand';

/**
 * Die App prueft jede Aktion, bevor sie geschieht — egal, ob sie von der KI
 * kommt oder aus dem eigenen Lesen. Rein, getestet.
 *
 * - Will der Satz loeschen, verschieben oder abhaken, wird nichts angelegt.
 * - Ein Titel, der mit dem Befehl des Satzes anfaengt („Lösche meinen
 *   Termin“), ist der nachgeplapperte Satz — kein Eintrag.
 * - „Loesch meinen Termin morgen“ loescht nur einen Termin von morgen.
 *
 * Was wegfaellt, zaehlt `dropped`: dann fragt die App nach, statt zu raten.
 */
export type Vetted = { actions: readonly AiAction[]; dropped: number };

export type Said = { text: string; today: string; items: readonly AiContextItem[] };

/** Was etwas Neues anlegt. */
const CREATING: ReadonlySet<string> = new Set([
  'create_event',
  'create_task',
  'create_note',
  'set_alarm',
  'add_birthday',
  'add_habit',
  'add_shopping',
  'add_chore',
  'log_water',
  'log_meal',
  'log_workout',
  'add_expense',
  'add_bill',
]);

/** Womit ein nachgeplapperter Befehl anfaengt. */
const ECHO =
  /^(?:bitte|kannst|könntest|koenntest|würdest|wuerdest|trag(?:e)?|erstell\p{L}*|leg(?:e)?|füg(?:e)?|fueg(?:e)?|notier\p{L}*|erinner\p{L}*|lösch\p{L}*|loesch\p{L}*|verschieb\p{L}*|streich(?:e)?|entfern(?:e)?)$/iu;

const lowerOf = (text: string) => text.toLocaleLowerCase('de');
const wordsOf = (text: string) => lowerOf(text).split(/[^\p{L}\p{N}]+/u).filter(Boolean);

/** Die Texte, die eine Aktion anlegen wuerde — Titel, Name, Bezeichnung, Posten. */
function namesOf(action: AiAction): string[] {
  const { title, name, label, items } = action.args;
  const listed = Array.isArray(items) ? items.filter((item): item is string => typeof item === 'string') : [];
  return [title, name, label].filter((value): value is string => typeof value === 'string').concat(listed);
}

/** Faengt ein Name mit einem Befehlswort an, das so im Satz steht? */
function echoes(action: AiAction, said: readonly string[]): boolean {
  return namesOf(action).some((value) => {
    const first = wordsOf(value)[0] ?? '';
    return ECHO.test(first) && said.includes(first);
  });
}

export function vetActions(actions: readonly AiAction[], said: Said): Vetted {
  const asked = commandOf(said.text);
  const spoken = wordsOf(said.text);
  const day = asked?.command === 'delete' ? dayIn(asked.subject, said.today) : null;
  const kept = actions.filter((action) => {
    if (CREATING.has(action.name)) return !asked && !echoes(action, spoken);
    if (action.name === 'delete_event' && day) {
      const item = said.items.find((entry) => entry.ref === action.args.ref);
      return !item?.date || item.date === day;
    }
    return true;
  });
  return { actions: kept, dropped: actions.length - kept.length };
}
