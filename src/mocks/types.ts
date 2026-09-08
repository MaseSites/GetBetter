import type { IconName } from '@/ui/Icon';

/** Die vier Bereiche aus dem Plattformkonzept. */
export const AREAS = ['health', 'organisation', 'money', 'household'] as const;
export type Area = (typeof AREAS)[number];

/**
 * Kernobjekte, auf die ein Modul zugreifen kann.
 * Diese Form ist bereits die echte — spaeter wird nur die Quelle getauscht.
 */
export const DATA_SCOPES = [
  'events',
  'tasks',
  'notes',
  'meals',
  'recipes',
  'workouts',
  'health_metrics',
  'money_entries',
  'documents',
  'contacts',
  'household',
  'location',
  'habits',
  'sleep',
  'vehicles',
  'pets',
  'plants',
  'travel',
] as const;
export type DataScope = (typeof DATA_SCOPES)[number];

export type ModulePermissions = {
  read: readonly DataScope[];
  write: readonly DataScope[];
};

export type ModulePriority = 1 | 2 | 3;

export type ModuleDefinition = {
  id: string;
  area: Area;
  name: string;
  short: string;
  description: string;
  icon: IconName;
  priority: ModulePriority;
  permissions: ModulePermissions;
  /** Kostet nichts extra, gehoert zum Abo. */
  includedInPlan?: boolean;
  /** Vorbelegung der Registry. Der laufende Zustand liegt im AppContext. */
  installed: boolean;
};

export type Role = 'owner' | 'adult' | 'teen' | 'child';

export type Member = {
  id: string;
  name: string;
  role: Role;
  imageUri?: string;
};

export type Household = {
  id: string;
  name: string;
  members: readonly Member[];
};

export type Person = {
  id: string;
  firstName: string;
  email: string;
  imageUri?: string;
  subscriptionPlan: string;
  subscriptionRenewsAt: string;
};

export type Appointment = {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  allDay?: boolean;
  /** Von welchem Modul der Eintrag kaeme. */
  sourceModuleId: string;
};

export type Task = {
  id: string;
  title: string;
  dueAt?: string;
  done: boolean;
  shared: boolean;
  sourceModuleId: string;
};

/** Eine Zeile Beispielinhalt auf der Modulkarte in "Heute". */
export type ModuleCardLine = {
  label: string;
  value: string;
};

export type ModuleCard = {
  moduleId: string;
  headline: string;
  lines: readonly ModuleCardLine[];
};

export type AssistantRole = 'user' | 'assistant';

export type AssistantMessage = {
  id: string;
  role: AssistantRole;
  text: string;
  /** Module, die diese Antwort anfassen wuerde. */
  touches?: readonly string[];
  /** Zeigt die Bestaetigungsfrage vor dem Ausfuehren. */
  needsConfirmation?: boolean;
};
