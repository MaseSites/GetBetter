'use strict';

/**
 * Wer sieht was: jedes Konto bekommt nur seine eigenen Zeilen — dazu, was
 * mit ihm geteilt ist. Reine Rechnung ueber die Tabellen, getestet in
 * `scope.test.js`; `server.js` nutzt sie fuer `GET /v1/db` (`visibleTables`)
 * und `PUT /v1/db/:collection` (`mergeCollection`).
 *
 * Die Regeln:
 * - Das eigene Konto ganz, andere Konten nur, wenn man sie kennt (Haushalt,
 *   Kalender, Freigabe) — und dann nur Name, Bild und seit wann.
 * - Haushalte, in denen man Mitglied ist oder die man angelegt hat, samt
 *   ihren Mitgliedern; alles mit `householdId` darin (Einkauf, Aemtli …).
 * - Eigene Kalender und solche, in denen man Mitglied ist, samt Mitgliedern;
 *   Freigaben, an denen man beteiligt ist.
 * - Termine: eigene, die des Haushalts, die eines gemeinsamen Kalenders und
 *   die nicht privaten von Haushaltsmitgliedern und Konten, die ihren
 *   Kalender freigegeben haben.
 * - Alles andere mit `accountId`: nur eigene. Kinder (Packliste, Saetze, Mail-
 *   Nachrichten …) folgen ihrer Elternzeile. Zeilen ohne Besitzer sieht niemand.
 */

/** Was andere von einem Konto sehen — nie E-Mail, Einstellungen oder Abo. */
const PUBLIC_ACCOUNT_FIELDS = ['id', 'username', 'firstName', 'photoUploadId', 'createdAt'];

/** Kind-Sammlung -> das Feld mit der Id und die Sammlung, an der es haengt. */
const PARENT_LINKS = {
  petEvents: { field: 'petId', parent: 'pets' },
  packingItems: { field: 'tripId', parent: 'trips' },
  habitTicks: { field: 'habitId', parent: 'habits' },
  workoutSets: { field: 'workoutId', parent: 'workouts' },
  medTakes: { field: 'medId', parent: 'meds' },
  chatMessages: { field: 'chatId', parent: 'chats' },
  mailMessages: { field: 'mailAccountId', parent: 'mailAccounts' },
};

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isRow = (row) => isPlainObject(row) && typeof row.id === 'string';
const rowsIn = (tables, name) => (Array.isArray(tables?.[name]) ? tables[name].filter(isRow) : []);
const accepted = (row) => row.status === undefined || row.status === 'accepted';

/** Was ein Konto umgibt: seine Haushalte, Kalender und die Leute darin. */
function contextOf(tables, me) {
  const households = new Set();
  for (const row of rowsIn(tables, 'households')) if (row.createdBy === me) households.add(row.id);
  for (const row of rowsIn(tables, 'householdMembers')) {
    if (row.accountId === me) households.add(row.householdId);
  }

  const calendars = new Set();
  for (const row of rowsIn(tables, 'calendars')) if (row.ownerId === me) calendars.add(row.id);
  for (const row of rowsIn(tables, 'calendarMembers')) {
    if (row.accountId === me) calendars.add(row.calendarId);
  }

  const coMembers = new Set();
  const people = new Set();
  for (const row of rowsIn(tables, 'householdMembers')) {
    if (!households.has(row.householdId) || row.accountId === me) continue;
    people.add(row.accountId);
    if (accepted(row)) coMembers.add(row.accountId);
  }
  for (const row of rowsIn(tables, 'calendarMembers')) {
    if (calendars.has(row.calendarId) && row.accountId !== me) people.add(row.accountId);
  }

  const sharers = new Set();
  for (const row of rowsIn(tables, 'calendarShares')) {
    if (row.viewerId === me) {
      people.add(row.ownerId);
      if (accepted(row)) sharers.add(row.ownerId);
    } else if (row.ownerId === me) people.add(row.viewerId);
  }

  return { me, households, calendars, coMembers, sharers, people };
}

/** Sieht dieses Konto diese Zeile? */
function canSee(name, row, ctx, tables) {
  if (!isRow(row)) return false;
  const { me } = ctx;
  switch (name) {
    case 'accounts':
      return row.id === me || ctx.people.has(row.id);
    case 'households':
      return row.createdBy === me || ctx.households.has(row.id);
    case 'householdMembers':
      return row.accountId === me || ctx.households.has(row.householdId);
    case 'calendars':
      return row.ownerId === me || ctx.calendars.has(row.id);
    case 'calendarMembers':
      return row.accountId === me || ctx.calendars.has(row.calendarId);
    case 'calendarShares':
      return row.ownerId === me || row.viewerId === me;
    case 'events':
      if (row.accountId === me) return true;
      if (typeof row.householdId === 'string' && ctx.households.has(row.householdId)) return true;
      if (typeof row.calendarId === 'string' && ctx.calendars.has(row.calendarId)) return true;
      return (
        row.isPrivate !== true &&
        (ctx.coMembers.has(row.accountId) || ctx.sharers.has(row.accountId))
      );
    default: {
      const link = PARENT_LINKS[name];
      if (link) {
        const parent = rowsIn(tables, link.parent).find((entry) => entry.id === row[link.field]);
        return parent ? canSee(link.parent, parent, ctx, tables) : false;
      }
      if (row.accountId === me) return true;
      return typeof row.householdId === 'string' && ctx.households.has(row.householdId);
    }
  }
}

function publicAccount(row) {
  const copy = {};
  for (const field of PUBLIC_ACCOUNT_FIELDS) if (row[field] !== undefined) copy[field] = row[field];
  return copy;
}

/** Die Tabellen, wie dieses Konto sie sehen darf. Konten anderer nur oeffentlich. */
function visibleTables(tables, me) {
  const ctx = contextOf(tables, me);
  const out = {};
  for (const [name, rows] of Object.entries(tables)) {
    if (!Array.isArray(rows)) continue;
    const seen = rows.filter((row) => canSee(name, row, ctx, tables));
    out[name] =
      name === 'accounts' ? seen.map((row) => (row.id === me ? row : publicAccount(row))) : seen;
  }
  return out;
}

/**
 * Was eine App zurueckschreibt, ersetzt nur, was sie sehen darf; alles andere
 * bleibt, wie es war. Von den mitgeschickten Zeilen zaehlen nur die, die das
 * Konto nach den Regeln sehen duerfte — plus das, was es gerade neu anlegt:
 * einen eigenen Haushalt oder Kalender und die erste Mitgliedschaft darin.
 */
function mergeCollection(tables, name, me, incoming) {
  const ctx = contextOf(tables, me);
  const current = rowsIn(tables, name);
  const stored = new Map(current.map((row) => [row.id, row]));
  const membersOf = (householdId) =>
    rowsIn(tables, 'householdMembers').filter((row) => row.householdId === householdId);

  // Was die App ersetzen darf: bei Konten nur das eigene, sonst alles, was sie sieht.
  const replaceable = (row) =>
    name === 'accounts' ? row.id === me : canSee(name, row, ctx, tables);

  /**
   * Eine neue Zeile darf nur anlegen, wer sie danach auch besitzt — nie im
   * Namen eines anderen: keine Mitgliedschaft in fremden Haushalten, keine
   * Freigabe, die man sich selbst erteilt, kein Termin im Kalender eines
   * anderen. Einladen (eine Zeile fuer jemand anderen im eigenen Haushalt)
   * und Anfragen (eine offene Freigabe) bleiben moeglich.
   */
  const mayCreate = (row) => {
    switch (name) {
      case 'accounts':
        return false;
      case 'households':
        return row.createdBy === me;
      case 'calendars':
        return row.ownerId === me;
      case 'householdMembers':
        return (
          ctx.households.has(row.householdId) ||
          (row.accountId === me && membersOf(row.householdId).length === 0)
        );
      case 'calendarMembers':
        return ctx.calendars.has(row.calendarId);
      case 'calendarShares':
        return row.ownerId === me || (row.viewerId === me && row.status !== 'accepted');
      case 'events': {
        // Nie in einen Haushalt oder Kalender, in dem man nicht ist.
        const inHouse = typeof row.householdId === 'string';
        const inCalendar = typeof row.calendarId === 'string';
        if (inHouse && !ctx.households.has(row.householdId)) return false;
        if (inCalendar && !ctx.calendars.has(row.calendarId)) return false;
        return row.accountId === me || inHouse || inCalendar;
      }
      default: {
        const link = PARENT_LINKS[name];
        if (link) {
          const parent = rowsIn(tables, link.parent).find((entry) => entry.id === row[link.field]);
          return parent ? canSee(link.parent, parent, ctx, tables) : false;
        }
        const inHouse = typeof row.householdId === 'string';
        if (inHouse && !ctx.households.has(row.householdId)) return false;
        return row.accountId === me || inHouse;
      }
    }
  };

  const mayWrite = (row) => {
    if (!isRow(row)) return false;
    // Eine bekannte Zeile zaehlt nach dem, was gespeichert ist — nicht nach
    // dem, was die App behauptet: so laesst sich Fremdes nicht kapern.
    const known = stored.get(row.id);
    return known ? replaceable(known) : mayCreate(row);
  };

  const others = current.filter((row) => !replaceable(row));
  const mine = (Array.isArray(incoming) ? incoming : []).filter(mayWrite);
  // Nie das eigene Konto verlieren, auch wenn die App es nicht mitschickt.
  if (name === 'accounts' && !mine.some((row) => row.id === me)) {
    const own = current.find((row) => row.id === me);
    if (own) mine.push(own);
  }
  return [...others, ...mine];
}

module.exports = {
  PUBLIC_ACCOUNT_FIELDS,
  PARENT_LINKS,
  contextOf,
  canSee,
  visibleTables,
  mergeCollection,
  publicAccount,
};
