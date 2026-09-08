import type { AssistantMessage } from './types';

/**
 * P-017: Der Beispieldialog zeigt eine Aktion ueber mehrere Module hinweg,
 * inklusive der Bestaetigungsfrage vor dem Ausfuehren.
 */
export const ASSISTANT_THREAD: readonly AssistantMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    text: 'Plan mir morgen Abend Training und ein leichtes Znacht',
  },
  {
    id: 'msg-2',
    role: 'assistant',
    text: 'Ich wuerde das so machen — Training 18:30 bis 19:30, du hast dort nichts im Kalender. Danach Pouletsalat, etwa 480 kcal. Fuer den Salat fehlen dir drei Sachen, die kaemen auf die Einkaufsliste vom Haushalt. Soll ich?',
    touches: ['calendar', 'fitness', 'meals', 'shopping'],
    needsConfirmation: true,
  },
];

/** Die eine feste Antwort auf alles, was danach getippt wird. */
export const ASSISTANT_CANNED_REPLY =
  'Verstanden. Im Prototyp fuehre ich nichts wirklich aus — ich zeige nur, wie der Ablauf aussieht: vorschlagen, nachfragen, dann eintragen.';

/**
 * Beispiele, die zeigen, dass der Assistent quer ueber alle Module verwaltet.
 * Sie fuellen im Prototyp nur den Dialog, sie fuehren nichts aus.
 */
export const ASSISTANT_STARTERS: readonly string[] = [
  'Wie sieht mein Tag aus?',
  'Plan mir die Woche',
  'Was fehlt fuer das Znacht?',
  'Was ist diesen Monat teuer geworden?',
  'Erinner mich an die Steuererklaerung',
  'Verteil die Aemtli neu',
];

/** Wie lange die feste Antwort auf sich warten laesst, damit es echt wirkt. */
export const ASSISTANT_REPLY_DELAY_MS = 700;
