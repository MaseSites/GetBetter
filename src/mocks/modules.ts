import type { Area, ModuleDefinition } from './types';

/**
 * P-008: Die Modul-Registry, 24 Eintraege aus dem Plattformkonzept Kapitel 5.
 * Alle vier Bereiche sind besetzt, alle Prioritaeten 1 bis 3 kommen vor.
 * Die Struktur ist bereits die echte — spaeter wird nur die Quelle getauscht.
 */
export const MODULES: readonly ModuleDefinition[] = [
  // ---------- Organisation ----------
  {
    id: 'ai',
    area: 'organisation',
    name: 'KI-Chat',
    short: 'Eine ganz normale KI zum Fragen, Schreiben und Nachdenken',
    description:
      'Ein offenes Gespraech mit einer KI, wie du es kennst — Fragen stellen, Texte schreiben lassen, Dinge erklaeren lassen. Sie sieht deine Module und deine Daten nicht. Im Abo enthalten, kostet nichts extra. Nicht zu verwechseln mit dem Assistenten in der Mitte der Leiste: der verwaltet deine Module, der KI-Chat redet einfach.',
    icon: 'bulb',
    priority: 1,
    permissions: { read: [], write: [] },
    includedInPlan: true,
    installed: true,
  },
  {
    id: 'calendar',
    area: 'organisation',
    name: 'Kalender',
    short: 'Alle Termine an einem Ort, auch die vom Haushalt',
    description:
      'Fuehrt deine Termine und die des Haushalts zusammen. Andere Module tragen hier ein, statt eigene Kalender zu fuehren.',
    icon: 'calendar',
    priority: 1,
    permissions: { read: ['events', 'household'], write: ['events'] },
    installed: true,
  },
  {
    id: 'tasks',
    area: 'organisation',
    name: 'Aufgaben',
    short: 'Was ansteht, mit Frist und Zustaendigkeit',
    description:
      'Eine Liste fuer dich und eine fuer den Haushalt. Aufgaben aus anderen Modulen landen automatisch hier.',
    icon: 'checkCircle',
    priority: 1,
    permissions: { read: ['tasks', 'events', 'household'], write: ['tasks'] },
    installed: true,
  },
  {
    id: 'notes',
    area: 'organisation',
    name: 'Notizen',
    short: 'Gedanken, Listen und Links, durchsuchbar',
    description: 'Kurze Notizen mit Stichworten. Notizen lassen sich in Aufgaben verwandeln.',
    icon: 'note',
    priority: 2,
    permissions: { read: ['notes'], write: ['notes', 'tasks'] },
    installed: false,
  },
  {
    id: 'documents',
    area: 'organisation',
    name: 'Dokumente',
    short: 'Vertraege, Policen und Garantien mit Ablaufdatum',
    description:
      'Legt wichtige Dokumente ab und erinnert dich, bevor eine Frist oder eine Kuendigung faellig wird.',
    icon: 'doc',
    priority: 2,
    permissions: { read: ['documents'], write: ['documents', 'tasks', 'events'] },
    installed: false,
  },
  {
    id: 'habits',
    area: 'organisation',
    name: 'Gewohnheiten',
    short: 'Kleine Dinge, jeden Tag',
    description: 'Verfolgt wiederkehrende Vorhaben und zeigt dir, wie es ueber Wochen laeuft.',
    icon: 'repeat',
    priority: 2,
    permissions: { read: ['habits'], write: ['habits', 'tasks'] },
    installed: false,
  },
  {
    id: 'travel',
    area: 'organisation',
    name: 'Reisen',
    short: 'Fluege, Hotels und Packlisten an einem Ort',
    description:
      'Sammelt alles zu einer Reise: Termine, Buchungen, Dokumente und eine Packliste, die zur Dauer passt.',
    icon: 'travel',
    priority: 3,
    permissions: {
      read: ['travel', 'events', 'documents', 'location'],
      write: ['travel', 'events', 'tasks'],
    },
    installed: false,
  },
  {
    id: 'contacts',
    area: 'organisation',
    name: 'Kontakte',
    short: 'Menschen, Geburtstage und wann ihr euch zuletzt gesehen habt',
    description:
      'Haelt fest, wer dir wichtig ist, und erinnert dich an Geburtstage und laengeres Schweigen.',
    icon: 'people',
    priority: 3,
    permissions: { read: ['contacts', 'events'], write: ['contacts', 'events', 'tasks'] },
    installed: false,
  },

  // ---------- Gesundheit ----------
  {
    id: 'meals',
    area: 'health',
    name: 'Menuplan',
    short: 'Was diese Woche auf den Tisch kommt',
    description:
      'Plant Mahlzeiten fuer die Woche und schickt fehlende Zutaten auf die Einkaufsliste des Haushalts.',
    icon: 'meal',
    priority: 1,
    permissions: { read: ['meals', 'recipes', 'household'], write: ['meals', 'tasks', 'events'] },
    installed: true,
  },
  {
    id: 'fitness',
    area: 'health',
    name: 'Training',
    short: 'Trainings planen und festhalten',
    description:
      'Traegt Trainings in den Kalender ein und merkt sich, was du gemacht hast — ohne Wettbewerb.',
    icon: 'fitness',
    priority: 1,
    permissions: { read: ['workouts', 'events', 'health_metrics'], write: ['workouts', 'events'] },
    installed: false,
  },
  {
    id: 'sleep',
    area: 'health',
    name: 'Schlaf',
    short: 'Wann du ins Bett solltest, damit der Morgen geht',
    description:
      'Rechnet vom ersten Termin des naechsten Tages zurueck und schlaegt dir eine Zeit vor.',
    icon: 'sleep',
    priority: 2,
    permissions: { read: ['sleep', 'events'], write: ['sleep', 'events'] },
    installed: false,
  },
  {
    id: 'water',
    area: 'health',
    name: 'Trinken',
    short: 'Ein stiller Anstupser ueber den Tag',
    description: 'Zaehlt, was du getrunken hast, und erinnert dich, wenn lange nichts kam.',
    icon: 'water',
    priority: 3,
    permissions: { read: ['health_metrics'], write: ['health_metrics'] },
    installed: false,
  },
  {
    id: 'meds',
    area: 'health',
    name: 'Medikamente',
    short: 'Einnahme, Vorrat und Rezept-Erneuerung',
    description:
      'Erinnert an die Einnahme und meldet sich, wenn die Packung oder das Rezept knapp wird.',
    icon: 'pill',
    priority: 2,
    permissions: { read: ['health_metrics', 'events'], write: ['tasks', 'events'] },
    installed: false,
  },
  {
    id: 'vitals',
    area: 'health',
    name: 'Werte',
    short: 'Gewicht, Blutdruck und Puls im Verlauf',
    description: 'Haelt Messwerte fest und zeigt sie als Verlauf, nicht als Urteil.',
    icon: 'chart',
    priority: 3,
    permissions: { read: ['health_metrics'], write: ['health_metrics'] },
    installed: false,
  },
  {
    id: 'mind',
    area: 'health',
    name: 'Kopf frei',
    short: 'Kurze Pausen und ein Satz am Abend',
    description: 'Schlaegt kurze Pausen vor und fragt abends nach einem Satz zum Tag.',
    icon: 'bulb',
    priority: 3,
    permissions: { read: ['notes', 'events'], write: ['notes', 'habits'] },
    installed: false,
  },

  // ---------- Haushalt ----------
  {
    id: 'shopping',
    area: 'household',
    name: 'Einkaufsliste',
    short: 'Geteilte Listen, automatisch aus deinen Rezepten',
    description:
      'Eine Liste, die alle im Haushalt sehen. Der Menuplan fuellt sie, ohne dass du tippen musst.',
    icon: 'cart',
    priority: 1,
    permissions: {
      read: ['tasks', 'meals', 'recipes', 'household'],
      write: ['tasks', 'money_entries'],
    },
    installed: true,
  },
  {
    id: 'chores',
    area: 'household',
    name: 'Aemtli',
    short: 'Wer macht was, und wann war es zuletzt dran',
    description:
      'Verteilt wiederkehrende Arbeiten im Haushalt und zeigt, wann etwas zuletzt gemacht wurde.',
    icon: 'broom',
    priority: 1,
    permissions: { read: ['tasks', 'household'], write: ['tasks'] },
    installed: false,
  },
  {
    id: 'recipes',
    area: 'household',
    name: 'Rezepte',
    short: 'Was ihr wirklich kocht, nicht was das Internet kocht',
    description:
      'Eure eigene Sammlung. Ein Rezept im Menuplan erzeugt die Zutaten auf der Einkaufsliste.',
    icon: 'book',
    priority: 2,
    permissions: { read: ['recipes', 'meals'], write: ['recipes', 'meals', 'tasks'] },
    installed: false,
  },
  {
    id: 'plants',
    area: 'household',
    name: 'Pflanzen',
    short: 'Giessen, ohne daran zu denken',
    description: 'Merkt sich, welche Pflanze wie oft Wasser braucht, und meldet sich rechtzeitig.',
    icon: 'plant',
    priority: 3,
    permissions: { read: ['plants'], write: ['plants', 'tasks'] },
    installed: false,
  },
  {
    id: 'pets',
    area: 'household',
    name: 'Haustiere',
    short: 'Futter, Impfungen und Tierarzttermine',
    description: 'Haelt fest, was das Tier braucht, und teilt die Aufgaben im Haushalt auf.',
    icon: 'pet',
    priority: 3,
    permissions: { read: ['pets', 'events', 'household'], write: ['pets', 'tasks', 'events'] },
    installed: false,
  },
  {
    id: 'vehicles',
    area: 'household',
    name: 'Fahrzeuge',
    short: 'Service, Vignette und Reifenwechsel',
    description: 'Erinnert an Service und Fristen und rechnet die Kosten pro Fahrzeug zusammen.',
    icon: 'car',
    priority: 3,
    permissions: {
      read: ['vehicles', 'documents', 'money_entries'],
      write: ['vehicles', 'tasks', 'events'],
    },
    installed: false,
  },

  // ---------- Geld ----------
  {
    id: 'budget',
    area: 'money',
    name: 'Budget',
    short: 'Was reinkommt, was rausgeht, was bleibt',
    description: 'Ordnet Ausgaben in Kategorien und zeigt, wo der Monat hingeht.',
    icon: 'wallet',
    priority: 1,
    permissions: { read: ['money_entries', 'household'], write: ['money_entries'] },
    installed: false,
  },
  {
    id: 'bills',
    area: 'money',
    name: 'Rechnungen',
    short: 'Faellig, bezahlt, offen',
    description:
      'Behaelt Faelligkeiten im Blick und legt rechtzeitig eine Aufgabe an, statt nur zu mahnen.',
    icon: 'mail',
    priority: 1,
    permissions: {
      read: ['money_entries', 'documents'],
      write: ['money_entries', 'tasks', 'events'],
    },
    installed: false,
  },
  {
    id: 'subscriptions',
    area: 'money',
    name: 'Abos',
    short: 'Was monatlich abgeht, und was weg koennte',
    description:
      'Sammelt laufende Abos, zeigt die Jahressumme und meldet sich vor der naechsten Verlaengerung.',
    icon: 'repeat',
    priority: 2,
    permissions: { read: ['money_entries', 'documents'], write: ['money_entries', 'tasks'] },
    installed: false,
  },
  {
    id: 'savings',
    area: 'money',
    name: 'Sparziele',
    short: 'Ein Ziel, ein Betrag, ein Datum',
    description: 'Rechnet aus, was pro Monat noetig ist, und zeigt, wie weit ihr seid.',
    icon: 'star',
    priority: 3,
    permissions: { read: ['money_entries', 'household'], write: ['money_entries', 'tasks'] },
    installed: false,
  },
] as const;

export const MODULES_BY_ID: Readonly<Record<string, ModuleDefinition>> = Object.fromEntries(
  MODULES.map((module) => [module.id, module]),
);

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULES_BY_ID[id];
}

export function modulesInArea(area: Area): readonly ModuleDefinition[] {
  return MODULES.filter((module) => module.area === area);
}

/** Vorbelegung fuer den ersten Start, bevor jemand das Onboarding durchlaeuft. */
export const DEFAULT_INSTALLED_IDS: readonly string[] = MODULES.filter(
  (module) => module.installed,
).map((module) => module.id);

/**
 * P-010: Vorschlaege im Onboarding. Priorität 1 und 2 der gewaehlten Bereiche,
 * damit eine andere Auswahl auch wirklich zu anderen Modulen fuehrt.
 */
export function suggestedModuleIds(areas: readonly Area[]): readonly string[] {
  if (areas.length === 0) return [];
  return MODULES.filter((module) => areas.includes(module.area) && module.priority <= 2).map(
    (module) => module.id,
  );
}

/** P-013: Suche ueber Name und Beschreibung. */
export function searchModules(query: string, area: Area | 'all'): readonly ModuleDefinition[] {
  const needle = query.trim().toLowerCase();
  return MODULES.filter((module) => {
    if (area !== 'all' && module.area !== area) return false;
    if (needle.length === 0) return true;
    return (
      module.name.toLowerCase().includes(needle) ||
      module.short.toLowerCase().includes(needle) ||
      module.description.toLowerCase().includes(needle)
    );
  });
}
