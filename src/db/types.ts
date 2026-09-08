/** Jede Zeile hat eine id. Zeitpunkte sind ISO-Strings. */
export type Row = { id: string };

export type Account = Row & {
  email: string;
  passwordHash: string;
  passwordSalt: string;
  firstName: string;
  language: string;
  onboarded: boolean;
  selectedAreas: readonly string[];
  favouriteModuleIds: readonly string[];
  householdName: string | null;
  createdAt: string;
};

export type EventRow = Row & {
  accountId: string;
  title: string;
  location: string | null;
  notes: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  /** Schluessel aus EVENT_COLORS. Fehlt er, gilt die Standardfarbe. */
  color: string | null;
  createdAt: string;
};

export type TaskRow = Row & {
  accountId: string;
  title: string;
  done: boolean;
  dueAt: string | null;
  shared: boolean;
  createdAt: string;
  completedAt: string | null;
};

export type NoteRow = Row & {
  accountId: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingItemRow = Row & {
  accountId: string;
  name: string;
  quantity: string | null;
  done: boolean;
  createdAt: string;
};

export type AlarmRow = Row & {
  accountId: string;
  /** "06:40" */
  time: string;
  label: string;
  /** Wochentage als 'mo' | 'di' | ... */
  days: readonly string[];
  enabled: boolean;
  createdAt: string;
};

/** Name -> Zeilentyp. Eine Stelle, an der alle Sammlungen stehen. */
export type Schema = {
  accounts: Account;
  events: EventRow;
  tasks: TaskRow;
  notes: NoteRow;
  shoppingItems: ShoppingItemRow;
  alarms: AlarmRow;
};

export const COLLECTION_NAMES = [
  'accounts',
  'events',
  'tasks',
  'notes',
  'shoppingItems',
  'alarms',
] as const satisfies readonly (keyof Schema)[];

export type CollectionName = keyof Schema;
