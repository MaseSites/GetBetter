/**
 * Der Plan zum Loeschen eines Kontos — rein gerechnet, ohne Speicher und Dateien.
 */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { applyPlan, backupOf, countsOf, planAccountDeletion, uploadRefsOf } = require('./deletion.js');

const DORA = 'acc_dora';
const sorted = (ids) => [...(ids ?? [])].sort();

const accounts = (overrides = {}) => [
  {
    id: DORA,
    email: 'dora@test.ch',
    username: 'dora',
    householdId: 'hh_shared',
    passwordHash: 'hash',
    passwordSalt: 'salz',
    ...overrides,
  },
  { id: 'acc_emil', email: 'emil@test.ch', username: 'emil', householdId: 'hh_shared' },
  { id: 'acc_fred', email: 'fred@test.ch', username: 'fred', householdId: null },
];

const member = (id, householdId, accountId, role, joinedAt, status = 'accepted') => ({
  id,
  householdId,
  accountId,
  role,
  status,
  joinedAt,
});

describe('planAccountDeletion', () => {
  test('returns null for an unknown account', () => {
    assert.equal(planAccountDeletion({ accounts: accounts() }, 'acc_fehlt'), null);
    assert.equal(planAccountDeletion({}, DORA), null);
  });

  test('removes private rows and keeps rows shared with a household that still has accepted members', () => {
    const tables = {
      accounts: accounts(),
      households: [{ id: 'hh_shared', name: 'Zuhause' }],
      householdMembers: [
        member('hm_dora', 'hh_shared', DORA, 'member', '2026-01-01'),
        member('hm_emil', 'hh_shared', 'acc_emil', 'admin', '2025-01-01'),
      ],
      appAccess: [{ id: 'aa1', accountId: DORA, appId: 'getbetter' }],
      shoppingItems: [
        { id: 's_shared', accountId: DORA, householdId: 'hh_shared', name: 'Milch' },
        { id: 's_private', accountId: DORA, householdId: null, name: 'Kaffee' },
        { id: 's_emil', accountId: 'acc_emil', householdId: null, name: 'Brot' },
      ],
      tasks: [
        { id: 't_private', accountId: DORA, householdId: null, shared: true },
        { id: 't_shared', accountId: DORA, householdId: 'hh_shared', shared: true },
      ],
      chats: [{ id: 'chat1', accountId: DORA }],
      chatMessages: [{ id: 'msg1', chatId: 'chat1', accountId: DORA }],
      pets: [
        { id: 'pet_shared', accountId: DORA, householdId: 'hh_shared' },
        { id: 'pet_private', accountId: DORA, householdId: null },
      ],
      petEvents: [
        { id: 'pe_shared', petId: 'pet_shared', accountId: DORA },
        { id: 'pe_private', petId: 'pet_private', accountId: DORA },
      ],
      habits: [{ id: 'habit1', accountId: DORA }],
      // Ein Kind faellt mit seiner Zeile, egal wem es gehoert.
      habitTicks: [{ id: 'tick1', habitId: 'habit1', accountId: 'acc_emil' }],
      mailAccounts: [{ id: 'mac1', accountId: DORA }],
      mailMessages: [{ id: 'mm1', accountId: DORA, mailAccountId: 'mac1' }],
      notifications: [
        { id: 'n_dora', accountId: DORA, kind: 'mail', ref: {} },
        { id: 'n_emil', accountId: 'acc_emil', kind: 'system', ref: {} },
      ],
      // Eine Sammlung, die eine App spaeter angelegt hat.
      weatherNotes: [{ id: 'w1', accountId: DORA }, 'kaputt', null],
    };

    const plan = planAccountDeletion(tables, DORA);

    assert.deepEqual(
      Object.fromEntries(Object.entries(plan.remove).map(([name, ids]) => [name, sorted(ids)])),
      {
        accounts: [DORA],
        householdMembers: ['hm_dora'],
        appAccess: ['aa1'],
        shoppingItems: ['s_private'],
        tasks: ['t_private'],
        chats: ['chat1'],
        pets: ['pet_private'],
        habits: ['habit1'],
        mailAccounts: ['mac1'],
        notifications: ['n_dora'],
        weatherNotes: ['w1'],
        chatMessages: ['msg1'],
        petEvents: ['pe_private'],
        habitTicks: ['tick1'],
        mailMessages: ['mm1'],
      },
    );
    assert.deepEqual(plan.update, {});
    assert.deepEqual(plan.dissolvedHouseholds, []);
  });

  test('a pending invitation does not keep a household alive: the last member dissolves it', () => {
    const tables = {
      accounts: accounts({ householdId: 'hh_solo' }).map((row) =>
        row.id === 'acc_fred' ? { ...row, householdId: 'hh_solo' } : row,
      ),
      households: [{ id: 'hh_solo' }, { id: 'hh_other' }],
      householdMembers: [
        member('hm_dora', 'hh_solo', DORA, 'admin', '2026-01-01'),
        member('hm_fred', 'hh_solo', 'acc_fred', 'member', '2026-02-01', 'pending'),
        member('hm_emil', 'hh_other', 'acc_emil', 'admin', '2026-01-01'),
        // Nur eingeladen: das loest keinen fremden Haushalt auf.
        member('hm_dora_invite', 'hh_other', DORA, 'member', '2026-03-01', 'pending'),
      ],
      chores: [
        { id: 'ch_solo', householdId: 'hh_solo', assignedTo: DORA },
        { id: 'ch_other', householdId: 'hh_other', assignedTo: 'acc_emil' },
      ],
      events: [{ id: 'ev_family', accountId: DORA, householdId: 'hh_solo', calendar: 'family' }],
      recipes: [{ id: 'r_foreign', accountId: 'acc_emil', householdId: 'hh_solo' }],
      notifications: [
        {
          id: 'n_invite',
          accountId: 'acc_fred',
          kind: 'householdInvite',
          ref: { membershipId: 'hm_fred', householdId: 'hh_solo' },
        },
        {
          id: 'n_own_invite',
          accountId: 'acc_emil',
          kind: 'householdInvite',
          ref: { membershipId: 'hm_dora_invite', householdId: 'hh_other' },
        },
        { id: 'n_other', accountId: 'acc_fred', kind: 'system', ref: {} },
      ],
    };

    const plan = planAccountDeletion(tables, DORA);

    assert.deepEqual(plan.dissolvedHouseholds, ['hh_solo']);
    assert.deepEqual(plan.remove.households, ['hh_solo']);
    assert.deepEqual(sorted(plan.remove.householdMembers), ['hm_dora', 'hm_dora_invite', 'hm_fred']);
    assert.deepEqual(plan.remove.chores, ['ch_solo']);
    assert.deepEqual(plan.remove.events, ['ev_family']);
    assert.deepEqual(plan.remove.recipes, ['r_foreign']);
    assert.deepEqual(sorted(plan.remove.notifications), ['n_invite', 'n_own_invite']);
    assert.deepEqual(plan.update, { accounts: [{ id: 'acc_fred', fields: { householdId: null } }] });
  });

  test('promotes the longest-standing accepted member when the last admin goes', () => {
    const tables = {
      accounts: accounts(),
      households: [{ id: 'hh_shared' }, { id: 'hh_two' }],
      householdMembers: [
        member('hm_dora', 'hh_shared', DORA, 'admin', '2026-01-01'),
        member('hm_emil', 'hh_shared', 'acc_emil', 'member', '2026-03-01'),
        member('hm_fred', 'hh_shared', 'acc_fred', 'member', '2026-02-01'),
        member('hm_gina', 'hh_shared', 'acc_gina', 'member', '2025-12-01', 'pending'),
        member('hm_dora2', 'hh_two', DORA, 'admin', '2026-01-01'),
        member('hm_emil2', 'hh_two', 'acc_emil', 'admin', '2026-04-01'),
      ],
    };

    const plan = planAccountDeletion(tables, DORA);

    assert.deepEqual(plan.update, { householdMembers: [{ id: 'hm_fred', fields: { role: 'admin' } }] });
    assert.equal(plan.remove.households, undefined);
    assert.deepEqual(sorted(plan.remove.householdMembers), ['hm_dora', 'hm_dora2']);
  });

  test('removes owned calendars with their members and events, and memberships in other calendars', () => {
    const tables = {
      accounts: accounts(),
      calendars: [
        { id: 'cal_dora', ownerId: DORA },
        { id: 'cal_fred', ownerId: 'acc_fred' },
      ],
      calendarMembers: [
        { id: 'cm1', calendarId: 'cal_dora', accountId: DORA, role: 'owner' },
        { id: 'cm2', calendarId: 'cal_dora', accountId: 'acc_fred', role: 'member' },
        { id: 'cm3', calendarId: 'cal_fred', accountId: 'acc_fred', role: 'owner' },
        { id: 'cm4', calendarId: 'cal_fred', accountId: DORA, role: 'member' },
      ],
      events: [
        { id: 'e_in_owned', accountId: 'acc_fred', householdId: null, calendarId: 'cal_dora' },
        { id: 'e_fred', accountId: 'acc_fred', householdId: null, calendarId: 'cal_fred' },
        { id: 'e_private', accountId: DORA, householdId: null, calendarId: null },
      ],
      notifications: [
        { id: 'n_invite', accountId: 'acc_fred', kind: 'calendarInvite', ref: { calendarId: 'cal_dora', membershipId: 'cm2' } },
        { id: 'n_fred', accountId: 'acc_fred', kind: 'calendarInvite', ref: { calendarId: 'cal_fred', membershipId: 'cm3' } },
      ],
    };

    const plan = planAccountDeletion(tables, DORA);

    assert.deepEqual(plan.remove.calendars, ['cal_dora']);
    assert.deepEqual(sorted(plan.remove.calendarMembers), ['cm1', 'cm2', 'cm4']);
    assert.deepEqual(sorted(plan.remove.events), ['e_in_owned', 'e_private']);
    assert.deepEqual(plan.remove.notifications, ['n_invite']);
  });

  test('removes calendar shares in both directions and the requests pointing at them', () => {
    const tables = {
      accounts: accounts(),
      calendarShares: [
        { id: 'sh1', ownerId: DORA, viewerId: 'acc_fred', status: 'accepted' },
        { id: 'sh2', ownerId: 'acc_fred', viewerId: DORA, status: 'pending' },
        { id: 'sh3', ownerId: 'acc_emil', viewerId: 'acc_fred', status: 'pending' },
      ],
      notifications: [
        { id: 'n_request', accountId: 'acc_fred', kind: 'calendarShare', ref: { shareId: 'sh2' } },
        { id: 'n_emil', accountId: 'acc_emil', kind: 'calendarShare', ref: { shareId: 'sh3' } },
      ],
    };

    const plan = planAccountDeletion(tables, DORA);

    assert.deepEqual(sorted(plan.remove.calendarShares), ['sh1', 'sh2']);
    assert.deepEqual(plan.remove.notifications, ['n_request']);
  });

  test('lists the uploads that no kept row references any more', () => {
    const tables = {
      accounts: accounts({ backdrop: 'upload:upl_back' }),
      tasks: [
        { id: 't1', accountId: DORA, householdId: null, attachmentIds: ['upl_a', 'upl_both'] },
        { id: 't2', accountId: 'acc_emil', householdId: null, attachmentIds: ['upl_both'] },
      ],
      notes: [{ id: 'n1', accountId: DORA, blocks: [{ kind: 'image', uploadId: 'upl_b' }, { kind: 'text' }, null] }],
      contacts: [{ id: 'c1', accountId: DORA, photoUploadId: 'upl_c' }],
    };

    const plan = planAccountDeletion(tables, DORA);

    assert.deepEqual(sorted(plan.uploadIds), ['upl_a', 'upl_b', 'upl_back', 'upl_c']);
    assert.deepEqual(uploadRefsOf({ backdrop: 'forest', photoUploadId: '', attachmentIds: [5, 'x'] }), ['x']);
  });
});

describe('applying and backing up a plan', () => {
  const tables = () => ({
    accounts: accounts(),
    households: [{ id: 'hh_shared' }],
    householdMembers: [
      member('hm_dora', 'hh_shared', DORA, 'admin', '2026-01-01'),
      member('hm_emil', 'hh_shared', 'acc_emil', 'member', '2026-02-01'),
    ],
    tasks: [
      { id: 't1', accountId: DORA, householdId: null },
      { id: 't2', accountId: 'acc_emil', householdId: null },
    ],
  });

  test('applyPlan returns new rows and leaves the input untouched', () => {
    const input = tables();
    const before = structuredClone(input);
    const plan = planAccountDeletion(input, DORA);

    const next = applyPlan(input, plan);

    assert.deepEqual(input, before);
    assert.deepEqual(Object.keys(next).sort(), ['accounts', 'householdMembers', 'tasks']);
    assert.deepEqual(next.accounts.map((row) => row.id), ['acc_emil', 'acc_fred']);
    assert.deepEqual(next.householdMembers, [{ ...before.householdMembers[1], role: 'admin' }]);
    assert.deepEqual(next.tasks.map((row) => row.id), ['t2']);
    assert.deepEqual(countsOf(plan), { accounts: 1, householdMembers: 1, tasks: 1 });
  });

  test('backupOf keeps every removed row and the changed rows before, never secrets', () => {
    const input = tables();
    const plan = planAccountDeletion(input, DORA);

    const backup = backupOf(input, plan, '2026-09-14T10:00:00.000Z');

    assert.equal(backup.accountId, DORA);
    assert.equal(backup.deletedAt, '2026-09-14T10:00:00.000Z');
    assert.deepEqual(backup.removed.tasks, [input.tasks[0]]);
    assert.equal(backup.removed.accounts[0].email, 'dora@test.ch');
    assert.equal(JSON.stringify(backup).includes('password'), false);
    assert.deepEqual(backup.updatedBefore.householdMembers, [input.householdMembers[1]]);
  });
});
