/**
 * Ein Konto loeschen — als Plan, ohne Speicher und ohne Dateien. `server.js`
 * schreibt erst die Sicherung, dann wendet es den Plan an.
 *
 * - Das Konto und jede Zeile mit seiner `accountId` fallen weg, ausser sie ist
 *   mit einem Haushalt geteilt, in dem noch jemand anderes zugesagt hat — dann
 *   bleibt sie dort, unveraendert. Kinder (Tiertermine, Packliste …) folgen der
 *   Zeile, an der sie haengen.
 * - Haushalte: die eigenen Mitgliedschaften fallen weg. Hat sonst niemand
 *   zugesagt, geht der Haushalt mit allem, was ihm gehoert, samt offener
 *   Einladungen. War das Konto der letzte Verwalter, wird das am laengsten
 *   dabei gebliebene Mitglied Verwalter (wie `households.leave`).
 * - Eigene Kalender gehen mit ihren Mitgliedern und Terminen; die eigenen
 *   Mitgliedschaften in fremden Kalendern und Freigaben in beide Richtungen auch.
 * - Mitteilungen anderer, die auf Weggefallenes zeigen, gehen mit.
 * - `uploadIds` sind Bilder, auf die danach keine Zeile mehr zeigt.
 */

const SECRET_FIELDS = ['passwordHash', 'passwordSalt'];

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

/** Diese Sammlungen haben eigene Regeln statt `accountId`. */
const OWN_RULES = new Set([
  'accounts',
  'households',
  'householdMembers',
  'calendars',
  'calendarMembers',
  'calendarShares',
]);

const UPLOAD_PREFIX = 'upload:';

const isPlainObject = (value) =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isRow = (row) => isPlainObject(row) && typeof row.id === 'string';
const rowsIn = (tables, name) => (Array.isArray(tables?.[name]) ? tables[name].filter(isRow) : []);
const isAccepted = (membership) => membership.status !== 'pending';
const refOf = (row) => (isPlainObject(row.ref) ? row.ref : {});
const joinedOf = (membership) =>
  typeof membership.joinedAt === 'string' ? membership.joinedAt : '￿';

/**
 * Sammelt, was wegfaellt und was sich aendert. Veraenderlich ist nur dieser
 * innere Zwischenstand; nach aussen geht ein frischer Plan aus Kopien.
 */
function createBuilder() {
  const removed = new Map();
  const updated = new Map();
  const bucket = (map, name, make) => {
    if (!map.has(name)) map.set(name, make());
    return map.get(name);
  };
  return {
    remove(name, id) {
      bucket(removed, name, () => new Set()).add(id);
    },
    has: (name, id) => removed.get(name)?.has(id) === true,
    update(name, id, fields) {
      const rows = bucket(updated, name, () => new Map());
      rows.set(id, { ...(rows.get(id) ?? {}), ...fields });
    },
    removed: () =>
      Object.fromEntries([...removed].map(([name, ids]) => [name, [...ids]])),
    updated: () =>
      Object.fromEntries(
        [...updated].map(([name, rows]) => [name, [...rows].map(([id, fields]) => ({ id, fields }))]),
      ),
  };
}

/** Wer ausser dem Konto noch in welchem Haushalt zugesagt hat — und welche sich aufloesen. */
function householdRules(tables, accountId) {
  const memberships = rowsIn(tables, 'householdMembers');
  const known = new Set(rowsIn(tables, 'households').map((row) => row.id));
  const acceptedOthers = (householdId) =>
    memberships.filter(
      (row) => row.householdId === householdId && row.accountId !== accountId && isAccepted(row),
    );
  const own = memberships.filter((row) => row.accountId === accountId);
  const dissolved = new Set(
    own
      .filter((row) => isAccepted(row) && known.has(row.householdId))
      .map((row) => row.householdId)
      .filter((householdId) => acceptedOthers(householdId).length === 0),
  );
  const sharedWithOthers = (householdId) =>
    typeof householdId === 'string' &&
    !dissolved.has(householdId) &&
    acceptedOthers(householdId).length > 0;
  return { memberships, own, dissolved, acceptedOthers, sharedWithOthers };
}

function planHouseholds(builder, tables, accountId, rules) {
  for (const membership of rules.own) builder.remove('householdMembers', membership.id);
  for (const householdId of rules.dissolved) {
    builder.remove('households', householdId);
    for (const membership of rules.memberships) {
      if (membership.householdId === householdId) builder.remove('householdMembers', membership.id);
    }
  }
  for (const membership of rules.own) {
    if (membership.role !== 'admin' || !isAccepted(membership)) continue;
    if (rules.dissolved.has(membership.householdId)) continue;
    const others = rules.acceptedOthers(membership.householdId);
    if (others.some((row) => row.role === 'admin')) continue;
    const [heir] = [...others].sort((a, b) => joinedOf(a).localeCompare(joinedOf(b)));
    if (heir) builder.update('householdMembers', heir.id, { role: 'admin' });
  }
  for (const other of rowsIn(tables, 'accounts')) {
    if (other.id !== accountId && rules.dissolved.has(other.householdId)) {
      builder.update('accounts', other.id, { householdId: null });
    }
  }
}

function planCalendars(builder, tables, accountId) {
  const owned = new Set(
    rowsIn(tables, 'calendars')
      .filter((row) => row.ownerId === accountId)
      .map((row) => row.id),
  );
  for (const id of owned) builder.remove('calendars', id);
  for (const row of rowsIn(tables, 'calendarMembers')) {
    if (owned.has(row.calendarId) || row.accountId === accountId) builder.remove('calendarMembers', row.id);
  }
  for (const row of rowsIn(tables, 'events')) {
    if (owned.has(row.calendarId)) builder.remove('events', row.id);
  }
  const shareIds = new Set(
    rowsIn(tables, 'calendarShares')
      .filter((row) => row.ownerId === accountId || row.viewerId === accountId)
      .map((row) => row.id),
  );
  for (const id of shareIds) builder.remove('calendarShares', id);
  return { calendarIds: owned, shareIds };
}

/** Eigene Zeilen aller uebrigen Sammlungen; Kinder erst, wenn ihre Eltern entschieden sind. */
function planOwnedRows(builder, tables, accountId, rules) {
  const names = Object.keys(tables ?? {}).filter((name) => !OWN_RULES.has(name));
  const isPrivate = (row) => row.accountId === accountId && !rules.sharedWithOthers(row.householdId);

  for (const name of names.filter((entry) => !PARENT_LINKS[entry])) {
    for (const row of rowsIn(tables, name)) {
      if (rules.dissolved.has(row.householdId) || isPrivate(row)) builder.remove(name, row.id);
    }
  }
  for (const name of names.filter((entry) => PARENT_LINKS[entry])) {
    const { field, parent } = PARENT_LINKS[name];
    const parents = new Map(rowsIn(tables, parent).map((row) => [row.id, row]));
    for (const row of rowsIn(tables, name)) {
      const parentRow = parents.get(row[field]);
      const parentGone = parentRow !== undefined && builder.has(parent, parentRow.id);
      const parentShared =
        parentRow !== undefined && !parentGone && rules.sharedWithOthers(parentRow.householdId);
      if (parentGone || rules.dissolved.has(row.householdId) || (isPrivate(row) && !parentShared)) {
        builder.remove(name, row.id);
      }
    }
  }
}

/** Einladungen und Freigaben anderer, die ins Leere zeigen wuerden. */
function planForeignNotifications(builder, tables, rules, calendars) {
  for (const row of rowsIn(tables, 'notifications')) {
    const ref = refOf(row);
    const stale =
      (row.kind === 'calendarInvite' &&
        (calendars.calendarIds.has(ref.calendarId) || builder.has('calendarMembers', ref.membershipId))) ||
      (row.kind === 'calendarShare' && calendars.shareIds.has(ref.shareId)) ||
      (row.kind === 'householdInvite' &&
        (rules.dissolved.has(ref.householdId) || builder.has('householdMembers', ref.membershipId)));
    if (stale) builder.remove('notifications', row.id);
  }
}

/** Welche Bilder eine Zeile nennt: Anhaenge, Kontaktfoto, Bildbloecke, eigener Hintergrund. */
function uploadRefsOf(row) {
  const ids = [
    row.photoUploadId,
    row.uploadId,
    ...(Array.isArray(row.attachmentIds) ? row.attachmentIds : []),
    ...(Array.isArray(row.blocks) ? row.blocks.map((block) => block?.uploadId) : []),
    typeof row.backdrop === 'string' && row.backdrop.startsWith(UPLOAD_PREFIX)
      ? row.backdrop.slice(UPLOAD_PREFIX.length)
      : undefined,
  ];
  return ids.filter((id) => typeof id === 'string' && id.length > 0);
}

function orphanedUploads(tables, builder) {
  const gone = new Set();
  const kept = new Set();
  for (const name of Object.keys(tables ?? {})) {
    for (const row of rowsIn(tables, name)) {
      const target = builder.has(name, row.id) ? gone : kept;
      for (const id of uploadRefsOf(row)) target.add(id);
    }
  }
  return [...gone].filter((id) => !kept.has(id));
}

/**
 * `planAccountDeletion(tables, accountId)` -> `{ accountId, remove, update,
 * uploadIds, dissolvedHouseholds }` oder null, wenn es das Konto nicht gibt.
 * `remove` ist `{ sammlung: [id] }`, `update` `{ sammlung: [{ id, fields }] }`.
 */
function planAccountDeletion(tables, accountId) {
  if (!rowsIn(tables, 'accounts').some((row) => row.id === accountId)) return null;
  const builder = createBuilder();
  const rules = householdRules(tables, accountId);

  builder.remove('accounts', accountId);
  planHouseholds(builder, tables, accountId, rules);
  const calendars = planCalendars(builder, tables, accountId);
  planOwnedRows(builder, tables, accountId, rules);
  planForeignNotifications(builder, tables, rules, calendars);

  return {
    accountId,
    remove: builder.removed(),
    update: builder.updated(),
    uploadIds: orphanedUploads(tables, builder),
    dissolvedHouseholds: [...rules.dissolved],
  };
}

/** Die neuen Zeilen jeder betroffenen Sammlung — `tables` bleibt, wie es ist. */
function applyPlan(tables, plan) {
  const names = new Set([...Object.keys(plan.remove), ...Object.keys(plan.update)]);
  return Object.fromEntries(
    [...names].map((name) => {
      const gone = new Set(plan.remove[name] ?? []);
      const changes = new Map((plan.update[name] ?? []).map(({ id, fields }) => [id, fields]));
      const rows = Array.isArray(tables?.[name]) ? tables[name] : [];
      const next = rows
        .filter((row) => !(isRow(row) && gone.has(row.id)))
        .map((row) => (isRow(row) && changes.has(row.id) ? { ...row, ...changes.get(row.id) } : row));
      return [name, next];
    }),
  );
}

/** `{ sammlung: Anzahl }` der Zeilen, die wegfallen. */
function countsOf(plan) {
  return Object.fromEntries(Object.entries(plan.remove).map(([name, ids]) => [name, ids.length]));
}

function withoutSecrets(row) {
  return Object.fromEntries(Object.entries(row).filter(([field]) => !SECRET_FIELDS.includes(field)));
}

/** Was in die Sicherung kommt: jede wegfallende Zeile und die geaenderten vorher — nie Salt oder Hash. */
function backupOf(tables, plan, deletedAt) {
  const pick = (name, ids) => {
    const wanted = new Set(ids);
    return rowsIn(tables, name)
      .filter((row) => wanted.has(row.id))
      .map(withoutSecrets);
  };
  return {
    accountId: plan.accountId,
    deletedAt,
    removed: Object.fromEntries(Object.entries(plan.remove).map(([name, ids]) => [name, pick(name, ids)])),
    updatedBefore: Object.fromEntries(
      Object.entries(plan.update).map(([name, rows]) => [name, pick(name, rows.map((row) => row.id))]),
    ),
    uploadIds: plan.uploadIds,
  };
}

module.exports = { applyPlan, backupOf, countsOf, planAccountDeletion, uploadRefsOf };
