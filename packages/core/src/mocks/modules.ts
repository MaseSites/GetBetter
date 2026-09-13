import { APP_MODULES, currentApp } from '../app/identity';

import { AREAS, type Area, type ModuleDefinition } from './types';

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
    topic: 'assistant',
    icon: 'bulb',
    priority: 1,
    permissions: { read: [], write: [] },
    includedInPlan: true,
  },
  {
    id: 'calendar',
    area: 'organisation',
    topic: 'planning',
    icon: 'calendar',
    priority: 1,
    permissions: { read: ['events', 'household'], write: ['events'] },
  },
  {
    id: 'mail',
    area: 'organisation',
    topic: 'communication',
    icon: 'mail',
    priority: 1,
    permissions: { read: ['mail'], write: ['mail'] },
  },
  {
    id: 'tasks',
    area: 'organisation',
    topic: 'planning',
    icon: 'checkCircle',
    priority: 1,
    permissions: { read: ['tasks', 'events', 'household'], write: ['tasks'] },
  },
  {
    id: 'alarm',
    area: 'organisation',
    topic: 'planning',
    icon: 'alarm',
    priority: 1,
    permissions: { read: ['events'], write: [] },
  },
  {
    id: 'weather',
    area: 'organisation',
    topic: 'everyday',
    icon: 'sun',
    priority: 1,
    permissions: { read: ['location'], write: [] },
  },
  {
    id: 'notes',
    area: 'organisation',
    topic: 'knowledge',
    icon: 'note',
    priority: 2,
    permissions: { read: ['notes'], write: ['notes', 'tasks'] },
  },
  {
    id: 'documents',
    area: 'organisation',
    topic: 'knowledge',
    icon: 'doc',
    priority: 2,
    permissions: { read: ['documents'], write: ['documents', 'tasks', 'events'] },
  },
  {
    id: 'habits',
    area: 'organisation',
    topic: 'everyday',
    icon: 'repeat',
    priority: 2,
    permissions: { read: ['habits'], write: ['habits', 'tasks'] },
  },
  {
    id: 'travel',
    area: 'organisation',
    topic: 'mobility',
    icon: 'travel',
    priority: 3,
    permissions: {
      read: ['travel', 'events', 'documents', 'location'],
      write: ['travel', 'events', 'tasks'],
    },
  },
  {
    id: 'contacts',
    area: 'organisation',
    topic: 'people',
    icon: 'people',
    priority: 3,
    permissions: { read: ['contacts', 'events'], write: ['contacts', 'events', 'tasks'] },
  },
  {
    id: 'birthdays',
    area: 'organisation',
    topic: 'people',
    icon: 'gift',
    priority: 3,
    permissions: { read: ['contacts', 'events'], write: ['contacts'] },
  },

  // ---------- Gesundheit ----------
  {
    id: 'meals',
    area: 'health',
    topic: 'nutrition',
    icon: 'meal',
    priority: 1,
    permissions: { read: ['meals', 'recipes', 'household'], write: ['meals', 'tasks', 'events'] },
  },
  {
    id: 'fitness',
    area: 'health',
    topic: 'training',
    icon: 'fitness',
    priority: 1,
    permissions: { read: ['workouts', 'events', 'health_metrics'], write: ['workouts', 'events'] },
  },
  {
    id: 'sleep',
    area: 'health',
    topic: 'rest',
    icon: 'sleep',
    priority: 2,
    permissions: { read: ['sleep', 'events'], write: ['sleep', 'events'] },
  },
  {
    id: 'water',
    area: 'health',
    topic: 'nutrition',
    icon: 'water',
    priority: 3,
    permissions: { read: ['health_metrics'], write: ['health_metrics'] },
  },
  {
    id: 'meds',
    area: 'health',
    topic: 'body',
    icon: 'pill',
    priority: 2,
    permissions: { read: ['health_metrics', 'events'], write: ['tasks', 'events'] },
  },
  {
    id: 'vitals',
    area: 'health',
    topic: 'body',
    icon: 'chart',
    priority: 3,
    permissions: { read: ['health_metrics'], write: ['health_metrics'] },
  },
  {
    id: 'mind',
    area: 'health',
    topic: 'rest',
    icon: 'bulb',
    priority: 3,
    permissions: { read: ['notes', 'events'], write: ['notes', 'habits'] },
  },

  // ---------- Haushalt ----------
  {
    id: 'shopping',
    area: 'household',
    topic: 'supplies',
    icon: 'cart',
    priority: 1,
    permissions: {
      read: ['tasks', 'meals', 'recipes', 'household'],
      write: ['tasks', 'money_entries'],
    },
  },
  {
    id: 'chores',
    area: 'household',
    topic: 'supplies',
    icon: 'broom',
    priority: 1,
    permissions: { read: ['tasks', 'household'], write: ['tasks'] },
  },
  {
    id: 'recipes',
    area: 'household',
    topic: 'cooking',
    icon: 'book',
    priority: 2,
    permissions: { read: ['recipes', 'meals'], write: ['recipes', 'meals', 'tasks'] },
  },
  {
    id: 'plants',
    area: 'household',
    topic: 'living',
    icon: 'plant',
    priority: 3,
    permissions: { read: ['plants'], write: ['plants', 'tasks'] },
  },
  {
    id: 'pets',
    area: 'household',
    topic: 'living',
    icon: 'pet',
    priority: 3,
    permissions: { read: ['pets', 'events', 'household'], write: ['pets', 'tasks', 'events'] },
  },
  {
    id: 'vehicles',
    area: 'household',
    topic: 'mobility',
    icon: 'car',
    priority: 3,
    permissions: {
      read: ['vehicles', 'documents', 'money_entries'],
      write: ['vehicles', 'tasks', 'events'],
    },
  },

  // ---------- Geld ----------
  {
    id: 'budget',
    area: 'money',
    topic: 'spending',
    icon: 'wallet',
    priority: 1,
    permissions: { read: ['money_entries', 'household'], write: ['money_entries'] },
  },
  {
    id: 'bills',
    area: 'money',
    topic: 'spending',
    icon: 'mail',
    priority: 1,
    permissions: {
      read: ['money_entries', 'documents'],
      write: ['money_entries', 'tasks', 'events'],
    },
  },
  {
    id: 'subscriptions',
    area: 'money',
    topic: 'spending',
    icon: 'repeat',
    priority: 2,
    permissions: { read: ['money_entries', 'documents'], write: ['money_entries', 'tasks'] },
  },
  {
    id: 'savings',
    area: 'money',
    topic: 'saving',
    icon: 'star',
    priority: 3,
    permissions: { read: ['money_entries', 'household'], write: ['money_entries', 'tasks'] },
  },
] as const;

export const MODULES_BY_ID: Readonly<Record<string, ModuleDefinition>> = Object.fromEntries(
  MODULES.map((module) => [module.id, module]),
);

export function getModule(id: string): ModuleDefinition | undefined {
  return MODULES_BY_ID[id];
}

/**
 * Die Module der laufenden App. Jedes Modul gehoert genau einer Better-App —
 * BetterFamily zeigt also nie den Kalender, GetBetter nie die Einkaufsliste.
 */
/**
 * Was wirklich etwas tut. Der Rest zeigt ehrlich, dass er noch fehlt —
 * dieselbe Liste braucht die Startseite und der Funktionen-Bildschirm.
 */
export const BUILT_MODULE_IDS: readonly string[] = [
  'calendar',
  'tasks',
  'notes',
  'alarm',
  'ai',
  'shopping',
  'chores',
  'fitness',
  'meals',
  'water',
  'budget',
  'bills',
  'subscriptions',
  'savings',
  'documents',
  'habits',
  'travel',
  'contacts',
  'birthdays',
  'mail',
  'weather',
  'recipes',
  'plants',
  'pets',
  'vehicles',
  'sleep',
  'meds',
  'vitals',
  'mind',
];

export function modulesOfApp(): readonly ModuleDefinition[] {
  const mine = APP_MODULES[currentApp().id];
  return MODULES.filter((module) => mine.includes(module.id));
}

export function modulesInArea(area: Area): readonly ModuleDefinition[] {
  return modulesOfApp().filter((module) => module.area === area);
}

/**
 * Alle Module sind von Anfang an da. Sortiert wird nach Bereich —
 * die im Onboarding gewaehlten Bereiche kommen zuerst.
 */
export type ModuleGroup = {
  area: Area;
  modules: readonly ModuleDefinition[];
};

export function groupedModules(preferredAreas: readonly Area[] = []): readonly ModuleGroup[] {
  const first = AREAS.filter((area) => preferredAreas.includes(area));
  const rest = AREAS.filter((area) => !preferredAreas.includes(area));
  return [...first, ...rest]
    .map((area) => ({ area, modules: modulesInArea(area) }))
    .filter((group) => group.modules.length > 0);
}

/**
 * Was in "Heute" eine Karte bekommt: die wichtigsten Module der gewaehlten
 * Bereiche. Ohne Auswahl die wichtigsten aus allen Bereichen.
 */
export function highlightedModuleIds(areas: readonly Area[]): readonly string[] {
  const relevant = areas.length > 0 ? areas : AREAS;
  return modulesOfApp()
    .filter((module) => relevant.includes(module.area) && module.priority === 1)
    .map((module) => module.id);
}
