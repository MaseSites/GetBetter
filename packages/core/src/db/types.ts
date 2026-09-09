/** Jede Zeile hat eine id. Zeitpunkte sind ISO-Strings. */
export type Row = { id: string };

export type Account = Row & {
  email: string;
  /** Eindeutig, klein geschrieben. Darueber laedt man Externe ein. */
  username: string;
  /**
   * Kommt aus der Zeit, als jede App ihre Passwoerter selbst pruefte.
   * Heute macht das der Kontodienst; aeltere Zeilen haben die Felder noch.
   */
  passwordHash?: string;
  passwordSalt?: string;
  firstName: string;
  language: string;
  /** Aussehen: hell, dunkel oder dem Geraet folgen. Alte Zeilen kennen es nicht. */
  themeMode?: 'light' | 'dark' | 'system';
  /** Schluessel aus ACCENTS. */
  accentKey?: string;
  /** Voreinstellung: clean, colorful oder mono. */
  themePreset?: string;
  onboarded: boolean;
  selectedAreas: readonly string[];
  /** Der Haushalt, in dem dieses Konto gerade ist. */
  householdId: string | null;
  createdAt: string;
};

export type HouseholdRow = Row & {
  name: string;
  /** Sechs Zeichen, damit man ihn vorlesen kann. */
  inviteCode: string;
  createdBy: string;
  createdAt: string;
};

/** Verwalter duerfen den Haushalt aendern und Mitglieder verwalten. */
export type HouseholdRole = 'admin' | 'member';

/** Per Benutzername Eingeladene muessen erst zustimmen. */
export type HouseholdMemberStatus = 'pending' | 'accepted';

export type HouseholdMemberRow = Row & {
  householdId: string;
  accountId: string;
  role: HouseholdRole;
  /** Fehlt bei aelteren Zeilen — die gelten als angenommen. */
  status?: HouseholdMemberStatus;
  invitedBy?: string;
  joinedAt: string;
};

/** In welchem Kalender ein Termin liegt. */
export type CalendarScope = 'personal' | 'family' | 'custom';

/** Ein selbst angelegter Kalender, der geteilt werden kann. */
export type CalendarRow = Row & {
  ownerId: string;
  name: string;
  /** Schluessel aus EVENT_COLORS. */
  color: string;
  createdAt: string;
};

export type CalendarShareStatus = 'pending' | 'accepted';
export type CalendarShareRole = 'owner' | 'member';

export type CalendarMemberRow = Row & {
  calendarId: string;
  accountId: string;
  role: CalendarShareRole;
  status: CalendarShareStatus;
  invitedBy: string;
  createdAt: string;
  respondedAt: string | null;
};

/**
 * Eine Freigabe zwischen zwei Konten: `viewerId` darf den persoenlichen
 * Kalender von `ownerId` sehen — ohne die als privat markierten Termine.
 * Im Haushalt braucht es das nicht, dort gilt die Mitgliedschaft.
 */
export type CalendarShareRow = Row & {
  ownerId: string;
  viewerId: string;
  status: CalendarShareStatus;
  createdAt: string;
  respondedAt: string | null;
};

/**
 * Wer sich in welcher Better-App schon angemeldet hat. GetBetter liest daran
 * ab, welche Apps freigeschaltet sind — mehr steht nicht drin.
 */
export type AppAccessRow = Row & {
  accountId: string;
  appId: string;
  firstSeenAt: string;
  lastSeenAt: string;
};

export type EventRow = Row & {
  accountId: string;
  /**
   * Derselbe Termin in mehreren Kalendern liegt als mehrere Zeilen mit
   * gleicher `groupId`. Aeltere Zeilen haben keine — dann gilt die eigene Id.
   */
  groupId?: string;
  /** Gesetzt, solange der Termin zu einem Haushalt gehoert. */
  householdId: string | null;
  calendar: CalendarScope;
  /** Gesetzt, wenn der Termin in einem selbst angelegten Kalender liegt. */
  calendarId: string | null;
  /** Nur fuer persoenliche Termine: dann sieht ihn niemand sonst. */
  isPrivate: boolean;
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
  householdId: string | null;
  title: string;
  done: boolean;
  dueAt: string | null;
  /** Geteilte Aufgaben sehen alle im Haushalt. */
  shared: boolean;
  /** Mit Fahne: steht in seinem Abschnitt oben. */
  priority?: boolean;
  notes?: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type NoteRow = Row & {
  accountId: string;
  title: string;
  body: string;
  /** Angeheftet: steht immer oben. */
  pinned?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type DocumentCategory = 'contract' | 'insurance' | 'warranty' | 'id' | 'other';

/** Ein Dokument mit Ablaufdatum — Vertrag, Police, Garantie, Ausweis. */
export type DocumentRow = Row & {
  accountId: string;
  title: string;
  category: DocumentCategory;
  /** `YYYY-MM-DD` oder null, wenn es nicht ablaeuft. */
  expiresOn: string | null;
  note: string | null;
  createdAt: string;
};

/** Eine Gewohnheit; die Haken liegen in `habitTicks`. */
export type HabitRow = Row & {
  accountId: string;
  name: string;
  /** Wie oft pro Woche man sie will, 1 bis 7. */
  targetPerWeek: number;
  createdAt: string;
};

/** Ein Haken an einem Tag. */
export type HabitTickRow = Row & {
  habitId: string;
  accountId: string;
  day: string;
};

/** Eine Reise mit Zeitraum; die Packliste liegt in `packingItems`. */
export type TripRow = Row & {
  accountId: string;
  name: string;
  destination: string | null;
  startDay: string;
  endDay: string;
  createdAt: string;
};

export type PackingItemRow = Row & {
  tripId: string;
  accountId: string;
  name: string;
  packed: boolean;
  createdAt: string;
};

/** Ein Mensch, an den man denken will. */
export type ContactRow = Row & {
  accountId: string;
  name: string;
  /** `YYYY-MM-DD` */
  birthday: string | null;
  phone: string | null;
  note: string | null;
  /** Wann man sich zuletzt gesehen hat, als Tag. */
  lastSeenOn: string | null;
  createdAt: string;
};

export type ShoppingItemRow = Row & {
  accountId: string;
  /** Gesetzt, sobald man in einem Haushalt ist — dann teilen sich alle die Liste. */
  householdId: string | null;
  name: string;
  quantity: string | null;
  done: boolean;
  createdAt: string;
};

/** Wie oft ein Aemtli wiederkehrt. */
export type ChoreRepeat = 'once' | 'daily' | 'weekly' | 'monthly';

export type ChoreRow = Row & {
  householdId: string;
  title: string;
  /** Konto-Id des zustaendigen Mitglieds, oder null fuer offen. */
  assignedTo: string | null;
  repeat: ChoreRepeat;
  dueAt: string | null;
  lastDoneAt: string | null;
  lastDoneBy: string | null;
  createdAt: string;
};

/** Ein Training: was, wie lange, wie anstrengend. */
export type WorkoutRow = Row & {
  accountId: string;
  /** Tag als `YYYY-MM-DD`, damit sich nach Tag gruppieren laesst. */
  day: string;
  kind: string;
  minutes: number;
  notes: string | null;
  createdAt: string;
};

/** Eine Mahlzeit mit ihren Kalorien. */
export type MealRow = Row & {
  accountId: string;
  day: string;
  name: string;
  kcal: number;
  /** Fruehstueck, Mittag, Abend, Snack — frei, aber vorgeschlagen. */
  slot: string;
  createdAt: string;
};

/** Getrunkene Menge eines Tages, in Deziliter. */
export type DrinkRow = Row & {
  accountId: string;
  day: string;
  amountDl: number;
  createdAt: string;
};

/** Eine Ausgabe — dem Tag zugeordnet, nach Monat gezaehlt. */
export type ExpenseRow = Row & {
  accountId: string;
  day: string;
  amountChf: number;
  /** Schluessel aus den Vorschlaegen (`food`, `home`, …) oder frei. */
  category: string;
  note: string | null;
  createdAt: string;
};

/** Das Budget eines Monats (`YYYY-MM`). */
export type BudgetRow = Row & {
  accountId: string;
  month: string;
  limitChf: number;
};

/** Eine Rechnung mit Faelligkeit; bezahlt, sobald `paidAt` steht. */
export type BillRow = Row & {
  accountId: string;
  title: string;
  amountChf: number;
  /** `YYYY-MM-DD` */
  dueDay: string;
  paidAt: string | null;
  createdAt: string;
};

export type SubscriptionInterval = 'month' | 'year';

/** Ein laufendes Abo. */
export type SubscriptionRow = Row & {
  accountId: string;
  name: string;
  amountChf: number;
  interval: SubscriptionInterval;
  createdAt: string;
};

/** Ein Sparziel und was schon drauf liegt. */
export type SavingsGoalRow = Row & {
  accountId: string;
  name: string;
  targetChf: number;
  savedChf: number;
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
  households: HouseholdRow;
  householdMembers: HouseholdMemberRow;
  calendars: CalendarRow;
  calendarMembers: CalendarMemberRow;
  calendarShares: CalendarShareRow;
  appAccess: AppAccessRow;
  events: EventRow;
  tasks: TaskRow;
  notes: NoteRow;
  shoppingItems: ShoppingItemRow;
  chores: ChoreRow;
  alarms: AlarmRow;
  workouts: WorkoutRow;
  meals: MealRow;
  drinks: DrinkRow;
  expenses: ExpenseRow;
  budgets: BudgetRow;
  bills: BillRow;
  subscriptions: SubscriptionRow;
  savingsGoals: SavingsGoalRow;
  documents: DocumentRow;
  habits: HabitRow;
  habitTicks: HabitTickRow;
  trips: TripRow;
  packingItems: PackingItemRow;
  contacts: ContactRow;
};

export const COLLECTION_NAMES = [
  'accounts',
  'households',
  'householdMembers',
  'calendars',
  'calendarMembers',
  'calendarShares',
  'appAccess',
  'events',
  'tasks',
  'notes',
  'shoppingItems',
  'chores',
  'alarms',
  'workouts',
  'meals',
  'drinks',
  'expenses',
  'budgets',
  'bills',
  'subscriptions',
  'savingsGoals',
  'documents',
  'habits',
  'habitTicks',
  'trips',
  'packingItems',
  'contacts',
] as const satisfies readonly (keyof Schema)[];

export type CollectionName = keyof Schema;
