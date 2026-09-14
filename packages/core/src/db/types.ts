import type { AvatarStyle } from '../features/avatar/style';

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
  /** Der Ort fuers Wetter; ohne ihn nimmt die App Zuerich. */
  weatherPlace?: WeatherPlace;
  /**
   * Die gemerkten Orte in der Reihenfolge der Liste. `weatherPlace` bleibt der
   * Ort, der gerade gilt; aeltere Konten haben nur ihn.
   */
  weatherPlaces?: readonly WeatherPlace[];
  /** Wie der Assistent heisst — beim Einrichten vergeben. */
  assistantName?: string;
  /**
   * Mit welcher Stimme er spricht: der `voiceURI` aus `speechSynthesis`.
   * Fehlt er, nimmt die App die erste Stimme der eingestellten Sprache.
   */
  assistantVoice?: string;
  /**
   * Wie sein Avatar aussieht: Figur, Farbe, Augen, Zubehoer. Aeltere Konten
   * haben keinen — dann gilt `DEFAULT_AVATAR`. Immer ueber `normalizeAvatar` lesen.
   */
  assistantAvatar?: AvatarStyle;
  /**
   * Der Hintergrund: fehlt er oder steht er auf `app`, zeigt jede App ihr eigenes
   * Bild; sonst ein Schluessel aus `BACKDROPS` oder `upload:<id>` fuer ein eigenes.
   */
  backdrop?: string;
  /** Schnellzugriff und Favoriten als `appId:moduleId`, in der gewaehlten Reihenfolge. */
  favorites?: readonly string[];
  /**
   * Der Schnellzugriff auf der Startseite — eine **eigene** Liste, nicht die
   * Favoriten: was man oft braucht, ist nicht dasselbe wie was man mag.
   */
  quickAccess?: readonly string[];
  /** Im Admin gesperrt: Anmelden geht nicht mehr, eine offene Sitzung sieht nur die Sperre. */
  disabled?: boolean;
  /** Im Admin weggenommene Apps (`AppId`). Fehlt es, sind alle freigeschaltet. */
  blockedApps?: readonly string[];
  /**
   * Apps mit Abo (`AppId`) — bis es den Kauf im Store gibt, setzt sie nur der
   * Admin. Ohne Abo gilt ein kleines Gratis-Kontingent fuer die KI.
   */
  paidApps?: readonly string[];
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

/** Wie wichtig eine Aufgabe ist: 0 keine, 1 !, 2 !!, 3 !!!. */
export type TaskPriority = 0 | 1 | 2 | 3;

export type TaskRepeatUnit = 'day' | 'week' | 'month' | 'year';

/** Wie eine Aufgabe wiederkehrt: alle `every` Einheiten. */
export type TaskRepeat = {
  every: number;
  unit: TaskRepeatUnit;
  /** Nur bei `week`: die Wochentage, 1 Montag bis 7 Sonntag. */
  weekdays?: readonly number[];
  /** Ab dem Erledigen zaehlen statt ab der letzten Frist. */
  fromCompletion: boolean;
};

export type TaskRow = Row & {
  accountId: string;
  householdId: string | null;
  title: string;
  done: boolean;
  dueAt: string | null;
  /** Geteilte Aufgaben sehen alle im Haushalt. */
  shared: boolean;
  /**
   * Wichtigkeit. Aeltere Zeilen tragen hier die Fahne als `true` — deshalb
   * immer ueber `priorityOf` (`db/taskFields.ts`) lesen.
   */
  priority?: boolean | TaskPriority;
  notes?: string | null;
  /** Uhrzeit zur Frist als `HH:MM`; ohne sie gilt die Frist den ganzen Tag. */
  dueTime?: string | null;
  /** Das Projekt (`projects`), in dem die Aufgabe steht. */
  projectId?: string | null;
  /** Abschnitt im Projekt — ein Name aus `ProjectRow.sections`. */
  section?: string | null;
  tags?: readonly string[];
  /** Nur bei Unteraufgaben: die Aufgabe darueber. */
  parentId?: string | null;
  repeat?: TaskRepeat | null;
  /** Erinnern so viele Minuten vor der Frist; null heisst nicht erinnern. */
  reminderOffsetMinutes?: number | null;
  /** Reihenfolge von Hand, kleiner steht oben. */
  order?: number;
  /** Angehaengte Dateien aus `/v1/uploads`. */
  attachmentIds?: readonly string[];
  createdAt: string;
  completedAt: string | null;
};

/** Ein Projekt fuer Aufgaben, wahlweise mit Abschnitten. */
export type ProjectRow = Row & {
  accountId: string;
  /** Gesetzt, wenn der Haushalt das Projekt teilt. */
  householdId?: string | null;
  name: string;
  /** Reihenfolge in der Liste, kleiner steht oben. */
  order: number;
  /** Die Abschnitte in ihrer Reihenfolge; `TaskRow.section` nennt einen davon. */
  sections?: readonly string[];
  createdAt: string;
};

export type NoteBlockKind =
  'title' | 'heading' | 'text' | 'bullet' | 'number' | 'check' | 'quote' | 'image';

/** Ein Absatz einer Notiz. */
export type NoteBlock = {
  id: string;
  kind: NoteBlockKind;
  /** Bei `image` leer. */
  text: string;
  /** Nur bei `check`. */
  checked?: boolean;
  /** Einrueckung in Listen, 0 ganz links. */
  indent?: number;
  /** Nur bei `image`: das Bild aus `/v1/uploads`. */
  uploadId?: string;
};

export type NoteRow = Row & {
  accountId: string;
  /**
   * Reiner Text fuer Suche und Vorschau. Hat die Notiz Bloecke, sind Titel und
   * Text daraus abgeleitet (`noteTextOf` in `db/noteBlocks.ts`).
   */
  title: string;
  body: string;
  /** Angeheftet: steht immer oben. */
  pinned?: boolean;
  /** Der Inhalt. Aeltere Zeilen haben keine Bloecke — `blocksOf` macht welche daraus. */
  blocks?: readonly NoteBlock[];
  /** Der Ordner (`noteFolders`); ohne ihn liegt die Notiz ganz oben. */
  folderId?: string | null;
  /** Gesetzt, solange die Notiz im Papierkorb liegt. */
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

/** Ein Ordner fuer Notizen, auch in einem anderen Ordner. */
export type NoteFolderRow = Row & {
  accountId: string;
  name: string;
  parentId?: string | null;
  /** Reihenfolge in der Liste, kleiner steht oben. */
  order: number;
  /** Wie der Ordner seine Notizen zeigt; ohne Angabe als Liste. */
  view?: 'list' | 'grid';
  createdAt: string;
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

/** Eine Geschenkidee fuer einen Menschen — oder was man schon geschenkt hat. */
export type ContactGift = {
  id: string;
  text: string;
  url?: string;
  /** Frei geschrieben, etwa „CHF 40“. */
  price?: string;
  /** Das Jahr, in dem es verschenkt wurde; null oder fehlend heisst noch offen. */
  givenYear?: number | null;
};

/** Wann an einen Geburtstag erinnert wird. */
export type BirthdayReminders = { weekBefore: boolean; dayOf: boolean };

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
  /** Profilbild aus `/v1/uploads`. */
  photoUploadId?: string | null;
  /** Ob das Jahr in `birthday` stimmt. Fehlt es, gilt es als bekannt. */
  birthYearKnown?: boolean;
  /** Ein Mensch, der einem nah ist. */
  close?: boolean;
  gifts?: readonly ContactGift[];
  /** null heisst keine Erinnerung; fehlt es, gilt die Voreinstellung. */
  birthdayReminders?: BirthdayReminders | null;
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

/** Ein Gespraech in BetterAi; die Nachrichten liegen in `chatMessages`. */
export type ChatRow = Row & {
  accountId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatMessageRow = Row & {
  chatId: string;
  accountId: string;
  role: 'user' | 'assistant';
  text: string;
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
  /** Klingelton, Schluessel aus ALARM_SOUNDS. Aeltere Zeilen kennen ihn nicht. */
  sound?: string;
  snooze?: boolean;
  snoozeMinutes?: number;
  createdAt: string;
};

/** Der Ort, fuer den das Wetter gilt. */
export type WeatherPlace = { name: string; lat: number; lon: number };

/** Woher eine Mitteilung kommt — danach richten sich ihre Knoepfe. */
export type NotificationKind =
  'calendarShare' | 'calendarInvite' | 'householdInvite' | 'mail' | 'system';

/**
 * Eine Mitteilung fuer die Glocke und fuer „Was gibt's Neues“. Die Sammlung
 * gehoert dem Dienst: Apps lesen sie, schreiben aber nur ueber
 * `/v1/notifications` — sonst ueberschriebe eine App, was der Dienst gerade
 * fuer eine neue E-Mail angelegt hat.
 */
export type NotificationRow = Row & {
  accountId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Worauf sie zeigt, je Art eigene Felder: shareId, membershipId, mailMessageId … */
  ref: Readonly<Record<string, string>>;
  /** Aus welcher App sie stammt. */
  app: string;
  createdAt: string;
  /** Gesetzt, sobald sie in „Was gibt's Neues“ als gelesen markiert wurde. */
  readAt: string | null;
};

/**
 * Wie ein Ordner heisst, unabhaengig vom Anbieter. `[Gmail]/Papierkorb` und
 * `INBOX.Gel&APY-scht` sind beide `trash` — der Dienst rechnet das um.
 */
export type MailFolderRole = 'inbox' | 'sent' | 'drafts' | 'junk' | 'trash' | 'archive';

/** Alle Rollen, in der Reihenfolge, in der die Ordner angezeigt werden. */
export const MAIL_FOLDER_ROLES = [
  'inbox',
  'sent',
  'drafts',
  'junk',
  'trash',
  'archive',
] as const satisfies readonly MailFolderRole[];

/** Ein Ordner eines Postfachs: seine Rolle und sein Name auf dem Mailserver. */
export type MailFolder = { role: MailFolderRole; name: string };

/** Was an einer E-Mail haengt. Der Inhalt wird nicht geholt, nur die Kopfdaten. */
export type MailAttachment = {
  /** Leer, wenn der Mailserver keinen Namen mitschickt. */
  filename: string;
  /** `application/pdf`, `image/png` … */
  mime: string;
  /** Groesse in Bytes, wie der Mailserver sie meldet. */
  size: number;
};

/** Ein verbundenes E-Mail-Konto — ohne Passwort; das bleibt verschluesselt beim Dienst. */
export type MailAccountRow = Row & {
  accountId: string;
  email: string;
  displayName: string;
  /** Erkannter Anbieter (`gmx`, `gmail` …) oder `custom`. */
  provider: string;
  username: string;
  imapHost: string;
  imapPort: number;
  imapSecure: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  /** Die Ordner, die der Dienst beim Abgleich gefunden hat. */
  folders: readonly MailFolder[];
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type MailAddress = { name: string; address: string };

/** Eine E-Mail aus einem Ordner, wie der Dienst sie abgeholt hat. Gehoert dem Dienst. */
export type MailMessageRow = Row & {
  accountId: string;
  mailAccountId: string;
  /** Der Name auf dem Mailserver — damit spricht der Dienst den Ordner an. */
  folder: string;
  folderRole: MailFolderRole;
  uid: number;
  messageId: string | null;
  from: MailAddress;
  to: readonly MailAddress[];
  cc: readonly MailAddress[];
  subject: string;
  /** ISO-Zeitpunkt. */
  date: string;
  snippet: string;
  /** Der Text der Nachricht, ohne HTML, gekuerzt. */
  text: string;
  seen: boolean;
  /** Mit Fahne versehen (`\Flagged`). */
  flagged: boolean;
  /** Schon beantwortet (`\Answered`). */
  answered: boolean;
  attachments: readonly MailAttachment[];
  /** Kam nach dem Verbinden an — nur solche werden zu Neuigkeiten. */
  arrivedAfterConnect: boolean;
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
  projects: ProjectRow;
  notes: NoteRow;
  noteFolders: NoteFolderRow;
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
  chats: ChatRow;
  chatMessages: ChatMessageRow;
  notifications: NotificationRow;
  mailAccounts: MailAccountRow;
  mailMessages: MailMessageRow;
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
  'projects',
  'notes',
  'noteFolders',
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
  'chats',
  'chatMessages',
  'notifications',
  'mailAccounts',
  'mailMessages',
] as const satisfies readonly (keyof Schema)[];

export type CollectionName = keyof Schema;
