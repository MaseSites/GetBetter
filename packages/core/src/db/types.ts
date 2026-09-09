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
  /** Abteilung im Laden (`produce`, `dairy`, …); fehlt sie, wird geraten. */
  category?: string;
  done: boolean;
  createdAt: string;
};

/** Ein Rezept des Haushalts — oder das eigene, wenn man in keinem ist. */
export type RecipeRow = Row & {
  accountId: string;
  householdId: string | null;
  title: string;
  servings: number;
  /** Eine Zutat pro Zeile, mit Menge davor. */
  ingredients: readonly string[];
  steps: string;
  tags: readonly string[];
  createdAt: string;
};

/** Eine Pflanze mit Giessrhythmus. */
export type PlantRow = Row & {
  accountId: string;
  householdId: string | null;
  name: string;
  location: string | null;
  intervalDays: number;
  /** `YYYY-MM-DD` oder null, wenn noch nie gegossen. */
  lastWateredOn: string | null;
  createdAt: string;
};

export type PetKind = 'dog' | 'cat' | 'rabbit' | 'bird' | 'fish' | 'other';

export type PetRow = Row & {
  accountId: string;
  householdId: string | null;
  name: string;
  kind: PetKind;
  birthday: string | null;
  createdAt: string;
};

export type PetEventKind = 'vet' | 'vaccine' | 'worming' | 'grooming' | 'other';

/** Ein Termin fuer ein Tier: Tierarzt, Impfung, Entwurmung, Pflege. */
export type PetEventRow = Row & {
  petId: string;
  accountId: string;
  kind: PetEventKind;
  day: string;
  note: string | null;
  createdAt: string;
};

export type VehicleRow = Row & {
  accountId: string;
  householdId: string | null;
  name: string;
  plate: string | null;
  /** Naechster Service als Tag. */
  serviceOn: string | null;
  /** Naechster Reifenwechsel als Tag. */
  tyresOn: string | null;
  /** Das Jahr, fuer das die Vignette klebt. */
  vignetteYear: number | null;
  mileage: number | null;
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

/** Ein Satz in einem Training: Uebung, Gewicht, Wiederholungen. */
export type WorkoutSetRow = Row & {
  workoutId: string;
  accountId: string;
  exercise: string;
  weightKg: number | null;
  reps: number;
  createdAt: string;
};

/** Eine Vorlage: welche Uebungen ein Training hat. */
export type RoutineRow = Row & {
  accountId: string;
  name: string;
  exercises: readonly string[];
  createdAt: string;
};

/** Eine Nacht: wann ins Bett, wann raus, wie gut. */
export type SleepRow = Row & {
  accountId: string;
  /** Der Morgen danach, als Tag. */
  day: string;
  /** "23:00" */
  bedtime: string;
  /** "06:30" */
  wakeTime: string;
  /** 1 schlecht, 2 ok, 3 gut */
  quality: number;
  createdAt: string;
};

export type MedSlot = 'morning' | 'noon' | 'evening' | 'night';

/** Ein Medikament mit seinen Einnahmezeiten und dem Vorrat. */
export type MedRow = Row & {
  accountId: string;
  name: string;
  dose: string | null;
  slots: readonly MedSlot[];
  stock: number | null;
  createdAt: string;
};

/** Eine Einnahme an einem Tag zu einer Zeit. */
export type MedTakeRow = Row & {
  medId: string;
  accountId: string;
  day: string;
  slot: MedSlot;
  createdAt: string;
};

export type VitalKind = 'weight' | 'bp' | 'pulse';

/** Ein Messwert; beim Blutdruck ist `value2` der untere. */
export type VitalRow = Row & {
  accountId: string;
  kind: VitalKind;
  day: string;
  value: number;
  value2: number | null;
  createdAt: string;
};

/** Ein Satz zum Tag und wie er war, 1 bis 5. */
export type MoodRow = Row & {
  accountId: string;
  day: string;
  mood: number;
  note: string | null;
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
  recipes: RecipeRow;
  plants: PlantRow;
  pets: PetRow;
  petEvents: PetEventRow;
  vehicles: VehicleRow;
  workoutSets: WorkoutSetRow;
  routines: RoutineRow;
  sleeps: SleepRow;
  meds: MedRow;
  medTakes: MedTakeRow;
  vitals: VitalRow;
  moods: MoodRow;
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
  'recipes',
  'plants',
  'pets',
  'petEvents',
  'vehicles',
  'workoutSets',
  'routines',
  'sleeps',
  'meds',
  'medTakes',
  'vitals',
  'moods',
] as const satisfies readonly (keyof Schema)[];

export type CollectionName = keyof Schema;
