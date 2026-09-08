import type { Appointment, ModuleCard, Task } from './types';

/**
 * Ein realistischer Dienstag. Die Uhrzeiten haengen am aktuellen Datum,
 * damit der Prototyp nicht mit einem alten Tag im Kopf startet.
 */
function at(hour: number, minute = 0, dayOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export const TODAY_ISO = at(0);

export const APPOINTMENTS: readonly Appointment[] = [
  {
    id: 'a-1',
    title: 'Standup Team Nord',
    startsAt: at(9, 0),
    endsAt: at(9, 20),
    location: 'Videocall',
    sourceModuleId: 'calendar',
  },
  {
    id: 'a-2',
    title: 'Zahnarzt Kontrolle',
    startsAt: at(14, 30),
    endsAt: at(15, 15),
    location: 'Praxis Bahnhofstrasse',
    sourceModuleId: 'calendar',
  },
  {
    id: 'a-3',
    title: 'Nora abholen, Musikschule',
    startsAt: at(17, 45),
    endsAt: at(18, 0),
    location: 'Musikschule Wiesen',
    sourceModuleId: 'calendar',
  },
  {
    id: 'a-4',
    title: 'Krafttraining',
    startsAt: at(18, 30),
    endsAt: at(19, 30),
    location: 'Fitnesscenter Puls',
    sourceModuleId: 'fitness',
  },
];

export const TASKS: readonly Task[] = [
  {
    id: 't-1',
    title: 'Steuererklaerung einreichen',
    dueAt: at(23, 59),
    done: false,
    shared: false,
    sourceModuleId: 'documents',
  },
  {
    id: 't-2',
    title: 'Rueckruf Versicherung',
    done: false,
    shared: false,
    sourceModuleId: 'tasks',
  },
  {
    id: 't-3',
    title: 'Milch, Poulet und Rucola kaufen',
    done: false,
    shared: true,
    sourceModuleId: 'shopping',
  },
  {
    id: 't-4',
    title: 'Badezimmer putzen',
    done: false,
    shared: true,
    sourceModuleId: 'chores',
  },
  {
    id: 't-5',
    title: 'Velolicht ersetzen',
    done: false,
    shared: false,
    sourceModuleId: 'tasks',
  },
  {
    id: 't-6',
    title: 'Geschenk fuer Jonas ueberlegen',
    done: true,
    shared: false,
    sourceModuleId: 'tasks',
  },
];

/**
 * Pro Modul eine Karte mit Beispielinhalt. In "Heute" wird nur gezeigt,
 * was auch installiert ist.
 */
export const MODULE_CARDS: readonly ModuleCard[] = [
  {
    moduleId: 'meals',
    headline: 'Heute Abend: Pouletsalat',
    lines: [
      { label: 'Mittag', value: 'Resten Linsencurry' },
      { label: 'Abend', value: 'Pouletsalat, ca. 480 kcal' },
      { label: 'Fehlt', value: '3 Zutaten auf der Einkaufsliste' },
    ],
  },
  {
    moduleId: 'shopping',
    headline: 'Einkaufsliste Zuhause',
    lines: [
      { label: 'Offen', value: '7 Dinge' },
      { label: 'Zuletzt', value: 'Jonas hat Brot ergaenzt' },
    ],
  },
  {
    moduleId: 'calendar',
    headline: 'Der Rest der Woche',
    lines: [
      { label: 'Morgen', value: 'Elterngespraech, 16:00' },
      { label: 'Donnerstag', value: 'Ferien buchen, Frist' },
    ],
  },
  {
    moduleId: 'tasks',
    headline: 'Deine Liste',
    lines: [
      { label: 'Heute faellig', value: '1 Aufgabe' },
      { label: 'Diese Woche', value: '4 Aufgaben' },
    ],
  },
  {
    moduleId: 'fitness',
    headline: 'Training heute',
    lines: [
      { label: 'Geplant', value: 'Kraft, 60 Minuten' },
      { label: 'Diese Woche', value: '2 von 3 erledigt' },
    ],
  },
  {
    moduleId: 'chores',
    headline: 'Aemtli im Haushalt',
    lines: [
      { label: 'Du', value: 'Badezimmer' },
      { label: 'Nora', value: 'Abfall, seit 2 Tagen offen' },
    ],
  },
  {
    moduleId: 'budget',
    headline: 'Monat bis jetzt',
    lines: [
      { label: 'Ausgegeben', value: 'CHF 1’840 von 2’600' },
      { label: 'Groesster Posten', value: 'Lebensmittel' },
    ],
  },
  {
    moduleId: 'bills',
    headline: 'Rechnungen',
    lines: [
      { label: 'Offen', value: '2, zusammen CHF 312' },
      { label: 'Naechste Frist', value: 'in 4 Tagen' },
    ],
  },
  {
    moduleId: 'documents',
    headline: 'Fristen',
    lines: [
      { label: 'Steuererklaerung', value: 'heute' },
      { label: 'Hausrat kuendbar', value: 'noch 3 Wochen' },
    ],
  },
  {
    moduleId: 'sleep',
    headline: 'Heute Abend',
    lines: [
      { label: 'Empfohlen', value: 'ab 22:45 ins Bett' },
      { label: 'Grund', value: 'Erster Termin 8:00' },
    ],
  },
  {
    moduleId: 'water',
    headline: 'Getrunken',
    lines: [{ label: 'Heute', value: '0.9 von 2.0 Liter' }],
  },
  {
    moduleId: 'meds',
    headline: 'Einnahme',
    lines: [
      { label: 'Morgens', value: 'erledigt' },
      { label: 'Vorrat', value: 'reicht 9 Tage' },
    ],
  },
  {
    moduleId: 'notes',
    headline: 'Zuletzt notiert',
    lines: [{ label: 'Gestern', value: 'Ideen Ferien Sommer' }],
  },
  {
    moduleId: 'habits',
    headline: 'Gewohnheiten',
    lines: [
      { label: 'Lesen', value: '5 Tage in Folge' },
      { label: 'Spazieren', value: 'heute offen' },
    ],
  },
  {
    moduleId: 'recipes',
    headline: 'Rezepte',
    lines: [{ label: 'Zuletzt gekocht', value: 'Linsencurry, vor 2 Tagen' }],
  },
  {
    moduleId: 'plants',
    headline: 'Pflanzen',
    lines: [{ label: 'Heute giessen', value: 'Monstera, Basilikum' }],
  },
  {
    moduleId: 'pets',
    headline: 'Mira',
    lines: [
      { label: 'Futter', value: 'reicht 5 Tage' },
      { label: 'Impfung', value: 'faellig im November' },
    ],
  },
  {
    moduleId: 'vehicles',
    headline: 'Skoda Fabia',
    lines: [
      { label: 'Service', value: 'in 1’200 km' },
      { label: 'Reifenwechsel', value: 'Termin offen' },
    ],
  },
  {
    moduleId: 'subscriptions',
    headline: 'Abos',
    lines: [
      { label: 'Pro Monat', value: 'CHF 84' },
      { label: 'Verlaengert bald', value: 'Musikdienst, in 6 Tagen' },
    ],
  },
  {
    moduleId: 'savings',
    headline: 'Ferien 2027',
    lines: [
      { label: 'Stand', value: 'CHF 1’200 von 4’000' },
      { label: 'Noetig', value: 'CHF 280 pro Monat' },
    ],
  },
  {
    moduleId: 'vitals',
    headline: 'Werte',
    lines: [{ label: 'Letzte Messung', value: 'vor 3 Tagen' }],
  },
  {
    moduleId: 'mind',
    headline: 'Kopf frei',
    lines: [{ label: 'Heute', value: 'Pause um 15:30 vorgeschlagen' }],
  },
  {
    moduleId: 'travel',
    headline: 'Naechste Reise',
    lines: [{ label: 'Geplant', value: 'noch nichts gebucht' }],
  },
  {
    moduleId: 'ai',
    headline: 'KI-Chat',
    lines: [{ label: 'Bereit', value: 'Frag, was du willst' }],
  },
  {
    moduleId: 'contacts',
    headline: 'Kontakte',
    lines: [{ label: 'Geburtstag', value: 'Sara, am Freitag' }],
  },
];

export const MODULE_CARDS_BY_ID: Readonly<Record<string, ModuleCard>> = Object.fromEntries(
  MODULE_CARDS.map((card) => [card.moduleId, card]),
);

/** P-018: Wochenansicht des Beispielmoduls Kalender. */
export type CalendarDay = {
  iso: string;
  entries: readonly Appointment[];
};

export const CALENDAR_WEEK: readonly CalendarDay[] = [
  { iso: at(0), entries: APPOINTMENTS },
  {
    iso: at(0, 0, 1),
    entries: [
      {
        id: 'a-5',
        title: 'Elterngespraech',
        startsAt: at(16, 0, 1),
        endsAt: at(16, 30, 1),
        location: 'Schulhaus Wiesen',
        sourceModuleId: 'calendar',
      },
    ],
  },
  {
    iso: at(0, 0, 2),
    entries: [
      {
        id: 'a-6',
        title: 'Ferien buchen, letzter Tag',
        startsAt: at(0, 0, 2),
        allDay: true,
        sourceModuleId: 'documents',
      },
      {
        id: 'a-7',
        title: 'Krafttraining',
        startsAt: at(18, 30, 2),
        endsAt: at(19, 30, 2),
        sourceModuleId: 'fitness',
      },
    ],
  },
  { iso: at(0, 0, 3), entries: [] },
  {
    iso: at(0, 0, 4),
    entries: [
      {
        id: 'a-8',
        title: 'Geburtstag Sara',
        startsAt: at(0, 0, 4),
        allDay: true,
        sourceModuleId: 'contacts',
      },
    ],
  },
  {
    iso: at(0, 0, 5),
    entries: [
      {
        id: 'a-9',
        title: 'Grosseinkauf',
        startsAt: at(10, 0, 5),
        endsAt: at(11, 30, 5),
        sourceModuleId: 'shopping',
      },
    ],
  },
  { iso: at(0, 0, 6), entries: [] },
];
