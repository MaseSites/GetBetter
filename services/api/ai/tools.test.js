const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { cleanContext, contextText, MAX_ITEMS } = require('./context.js');
const { APP_MODULES, MAX_ACTIONS, actionsOf, toolsFor } = require('./tools.js');

const call = (name, args) => ({
  id: `call_${name}`,
  type: 'function',
  function: { name, arguments: typeof args === 'string' ? args : JSON.stringify(args) },
});
const names = (app) => toolsFor(app).map((tool) => tool.function.name);

describe('Funktionen des Assistenten', () => {
  test('jede App bekommt nur ihre Funktionen, BetterAi keine', () => {
    assert.deepEqual(toolsFor('betterai'), []);
    assert.ok(names('getbetter').includes('create_event'));
    assert.ok(names('getbetter').includes('complete_task'));
    assert.equal(names('getbetter').includes('log_water'), false);
    assert.deepEqual(
      names('bettergym').sort(),
      ['log_meal', 'log_water', 'log_workout', 'open_function', 'set_theme'],
    );
    assert.deepEqual(names('bettermoney').sort(), ['add_bill', 'add_expense', 'open_function', 'set_theme']);
    for (const tool of toolsFor('betterfamily')) {
      assert.equal(tool.type, 'function');
      assert.equal(tool.function.parameters.type, 'object');
      assert.ok(tool.function.description.length > 10);
    }
    const open = toolsFor('bettermoney').find((tool) => tool.function.name === 'open_function');
    assert.deepEqual(open.function.parameters.properties.module.enum, APP_MODULES.bettermoney);
  });

  test('gueltige Aufrufe kommen aufgeraeumt zurueck', () => {
    const { actions, rejected } = actionsOf(
      [
        call('create_event', {
          title: '  Zahnarzt ',
          date: '2026-09-23',
          start: '14:00',
          end: '25:00',
          location: '',
          extra: 'weg damit',
        }),
        call('create_task', { title: 'Steuern', priority: '2' }),
        { type: 'function', function: { name: 'set_alarm', arguments: { time: '06:40', days: ['mo', 'di'] } } },
      ],
      'getbetter',
    );
    assert.equal(rejected, 0);
    assert.deepEqual(actions, [
      // Die falsche Endzeit ist nur ein Nebenfeld: sie faellt weg, der Termin bleibt.
      { name: 'create_event', args: { title: 'Zahnarzt', date: '2026-09-23', start: '14:00' } },
      { name: 'create_task', args: { title: 'Steuern', priority: 2 } },
      { name: 'set_alarm', args: { time: '06:40', days: ['mo', 'di'] } },
    ]);
  });

  test('ungueltig, fremd oder zu viele: weg damit', () => {
    const { actions, rejected } = actionsOf(
      [
        call('create_event', { title: 'Ohne Tag' }),
        call('create_event', { title: 'Falscher Tag', date: '23.09.2026' }),
        call('log_water', { dl: 5 }),
        call('open_function', { module: 'budget' }),
        call('delete_everything', {}),
        call('create_task', '{kaputt'),
        call('set_alarm', { time: '06:40', days: ['montag'] }),
        call('add_shopping', { items: [] }),
        { type: 'function' },
        null,
      ],
      'getbetter',
    );
    // Falsche Wochentage sind nur ein Nebenfeld: der Wecker bleibt, einmalig.
    assert.deepEqual(actions, [{ name: 'set_alarm', args: { time: '06:40' } }]);
    assert.equal(rejected, 9);

    const many = Array.from({ length: MAX_ACTIONS + 2 }, (_, index) => call('create_note', { title: `Notiz ${index}` }));
    const capped = actionsOf(many, 'getbetter');
    assert.equal(capped.actions.length, MAX_ACTIONS);
    assert.equal(capped.rejected, 2);
    assert.deepEqual(actionsOf(undefined, 'getbetter'), { actions: [], rejected: 0 });
    assert.deepEqual(actionsOf([call('set_theme', { mode: 'dark' })], 'betterai'), { actions: [], rejected: 1 });
  });

  test('Zahlen und Aufzaehlungen werden geprueft', () => {
    const ok = actionsOf(
      [
        call('log_meal', { name: 'Müesli', kcal: 350, slot: 'breakfast' }),
        call('log_workout', { kind: 'Laufen', minutes: 30.5 }),
        call('log_water', { dl: '2.5' }),
      ],
      'bettergym',
    );
    assert.deepEqual(ok.actions, [
      { name: 'log_meal', args: { name: 'Müesli', kcal: 350, slot: 'breakfast' } },
      { name: 'log_water', args: { dl: 2.5 } },
    ]);
    assert.equal(ok.rejected, 1);

    const money = actionsOf(
      [
        call('add_expense', { amount: 12.5, category: 'food' }),
        call('add_expense', { amount: 12.5, category: 'luxus' }),
        call('add_bill', { title: 'Miete', amount: 1200, due_date: '2026-10-01' }),
        call('add_bill', { title: 'Miete', amount: -5, due_date: '2026-10-01' }),
      ],
      'bettermoney',
    );
    assert.deepEqual(money.actions, [
      { name: 'add_expense', args: { amount: 12.5, category: 'food' } },
      // Eine unbekannte Kategorie ist nur ein Nebenfeld: die Ausgabe bleibt.
      { name: 'add_expense', args: { amount: 12.5 } },
      { name: 'add_bill', args: { title: 'Miete', amount: 1200, due_date: '2026-10-01' } },
    ]);
    assert.equal(money.rejected, 1);
  });
});

describe('Kontext fuer den Assistenten', () => {
  const now = '2026-09-21T19:42';

  test('ohne gueltiges now kein Kontext, Kaputtes faellt weg, Langes wird kurz', () => {
    assert.equal(cleanContext(null), null);
    assert.equal(cleanContext({ now: '21.09.2026' }), null);
    assert.equal(cleanContext([]), null);

    const context = cleanContext({
      now,
      items: [
        { ref: 'T1', kind: 'event', title: 'Zahn\narzt', date: '2026-09-23', time: '14:00', end: '15:00' },
        { ref: 'nicht so', kind: 'task', title: 'Steuern', date: 'bald' },
        { kind: 'geheim', title: 'fällt weg' },
        { kind: 'note', title: '   ' },
        { kind: 'note', title: 'x'.repeat(300) },
      ],
      facts: [{ label: 'Wasser heute', value: 5 }, { label: '', value: 'weg' }, 'kaputt'],
    });
    assert.deepEqual(context.items[0], {
      ref: 'T1',
      kind: 'event',
      title: 'Zahn arzt',
      date: '2026-09-23',
      time: '14:00',
      end: '15:00',
      note: null,
    });
    assert.deepEqual([context.items[1].ref, context.items[1].date], [null, null]);
    assert.equal(context.items.length, 3);
    assert.equal(context.items[2].title.length, 120);
    assert.ok(context.items[2].title.endsWith('…'));
    assert.deepEqual(context.facts, [{ label: 'Wasser heute', value: '5' }]);

    const lots = cleanContext({ now, items: Array.from({ length: 200 }, () => ({ kind: 'note', title: 'N' })) });
    assert.equal(lots.items.length, MAX_ITEMS);
  });

  test('als Text: jetzt, die naechsten Tage mit Wochentag, je Art ein Abschnitt', () => {
    const text = contextText(
      cleanContext({
        now,
        items: [
          { ref: 'A1', kind: 'task', title: 'Steuern', date: '2026-09-25' },
          { ref: 'T1', kind: 'event', title: 'Zahnarzt', date: '2026-09-23', time: '14:00', end: '15:00' },
          { ref: 'T2', kind: 'event', title: 'Ferien', date: '2026-09-28', note: 'ganztägig' },
          { kind: 'shopping', title: 'Milch' },
        ],
        facts: [{ label: 'Wasser heute', value: '5 dl' }],
      }),
    );
    const lines = text.split('\n');
    assert.equal(lines[0], 'Jetzt: Mo 2026-09-21, 19:42 Uhr.');
    assert.ok(lines[1].startsWith('Die naechsten Tage: heute Mo 2026-09-21 · morgen Di 2026-09-22 · Mi 2026-09-23'));
    assert.equal(lines[1].split(' · ').length, 14);
    // Termine vor Aufgaben, egal in welcher Reihenfolge sie kamen.
    assert.deepEqual(lines.slice(2), [
      'Termine:',
      '- [T1] Mi 2026-09-23 14:00–15:00 Zahnarzt',
      '- [T2] Mo 2026-09-28 Ferien (ganztägig)',
      'Offene Aufgaben:',
      '- [A1] Fr 2026-09-25 Steuern',
      'Einkaufsliste:',
      '- Milch',
      'Zahlen:',
      '- Wasser heute: 5 dl',
    ]);
  });
});
