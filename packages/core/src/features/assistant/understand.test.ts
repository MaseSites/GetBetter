import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AiContextItem } from '../../db/ai';
import {
  commandOf,
  daytime,
  matchItem,
  pendingOf,
  rangeOf,
  understand,
  whenHint,
  withClock,
  type Pending,
  type Understood,
} from './understand';

// Montag, 21. September 2026.
const TODAY = '2026-09-21';
const GETBETTER = ['calendar', 'tasks', 'notes', 'alarm', 'weather', 'documents', 'habits', 'travel', 'contacts', 'birthdays', 'mail'];
const ITEMS: AiContextItem[] = [
  { ref: 'T1', kind: 'event', title: 'Zahnarzt', date: '2026-09-23', time: '14:00', end: '15:00' },
  { ref: 'T2', kind: 'event', title: 'Fussball', date: '2026-09-24', time: '18:30' },
  { ref: 'T3', kind: 'event', title: 'Essen mit Anna', date: '2026-09-26' },
  { ref: 'A1', kind: 'task', title: 'Steuererklärung', date: '2026-09-25' },
  { ref: 'A2', kind: 'task', title: 'Velo flicken' },
  { kind: 'shopping', title: 'Milch' },
];

const say = (text: string, modules: readonly string[] = GETBETTER): Understood =>
  understand({ text, today: TODAY, modules, items: ITEMS });

/** Mit eigener Liste und offener Rückfrage. */
const sayWith = (text: string, items: AiContextItem[], pending: Pending | null = null): Understood =>
  understand({ text, today: TODAY, modules: GETBETTER, items, pending });

/** Zwei Termine morgen, einer übermorgen. */
const TOMORROW: AiContextItem[] = [
  { ref: 'T1', kind: 'event', title: 'Coiffeur', date: '2026-09-22', time: '10:00' },
  { ref: 'T2', kind: 'event', title: 'Zahnarzt', date: '2026-09-22', time: '15:00' },
  { ref: 'T3', kind: 'event', title: 'Fussball', date: '2026-09-23', time: '18:30' },
];

/** Was anlegt — das darf bei „lösch …“ nie herauskommen. */
const creates = (result: Understood) =>
  result?.kind === 'actions' && result.actions.some((action) => /^(create|add|set_alarm|log)/u.test(action.name));

/** Der eine Aufruf, den der Satz ergibt — oder null. */
const one = (text: string, modules?: readonly string[]) => {
  const result = say(text, modules);
  return result?.kind === 'actions' && result.actions.length === 1 ? result.actions[0] : null;
};

test('Uhrzeiten wie man sie sagt, und „um 3“ ist bei Terminen am Nachmittag', () => {
  assert.equal(withClock('um halb 7'), 'um 6:30');
  assert.equal(withClock('um halb sieben'), 'um 6:30');
  assert.equal(withClock('viertel nach 8'), '8:15');
  assert.equal(withClock('viertel vor zehn'), '9:45');
  assert.equal(withClock('um drei'), 'um 3');
  assert.equal(withClock('so gegen sechs'), 'so um 6');
  assert.equal(withClock('ca. 14:30'), 'um 14:30');
  assert.equal(daytime('03:00', 'morgen um 3'), '15:00');
  assert.equal(daytime('07:30', 'morgen früh um 7:30'), '07:30');
  assert.equal(daytime('09:00', 'um 9'), '09:00');
});

test('Termine — auch beiläufig gesagt', () => {
  assert.deepEqual(one('ich muss morgen um 3 zum coiffeur'), {
    name: 'create_event',
    args: { title: 'Coiffeur', date: '2026-09-22', start: '15:00' },
  });
  assert.deepEqual(one('Trag mir morgen um 10 Uhr Coiffeur ein'), {
    name: 'create_event',
    args: { title: 'Coiffeur', date: '2026-09-22', start: '10:00' },
  });
  assert.deepEqual(one('am freitag abend essen mit lisa'), {
    name: 'create_event',
    args: { title: 'Essen mit lisa', date: '2026-09-25', start: '18:00' },
  });
  assert.deepEqual(one('termin beim zahnarzt am 3.10. um 14:30'), {
    name: 'create_event',
    args: { title: 'Zahnarzt', date: '2026-10-03', start: '14:30' },
  });
  // Höfliche Füllwörter fallen weg, „Termin mit …“ bleibt stehen.
  assert.deepEqual(one('kannst du mir für nächsten dienstag einen termin mit dem vermieter um 17 uhr machen'), {
    name: 'create_event',
    args: { title: 'Termin mit dem vermieter', date: '2026-09-22', start: '17:00' },
  });
  // Ein ganzer Satz als Titel: das versteht die KI besser.
  assert.equal(say('morgen muss ich unbedingt noch mit dem chef über die neue stelle und den lohn reden'), null);
  // Anlegen ist nur gelesen — das entscheidet die KI.
  const later = say('übermorgen zahnarzt');
  assert.equal(later?.kind === 'actions' && later.sure, false);
  // Ohne Uhrzeit ganztägig.
  assert.deepEqual(one('übermorgen zahnarzt'), {
    name: 'create_event',
    args: { title: 'Zahnarzt', date: '2026-09-23' },
  });
});

test('Aufgaben: erinnern, „ich muss …“ ohne Zeit, mit Frist', () => {
  assert.deepEqual(one('erinner mich dass ich die krankenkasse anrufen muss'), {
    name: 'create_task',
    args: { title: 'Krankenkasse anrufen' },
  });
  assert.deepEqual(one('erinnere mich morgen an die steuern'), {
    name: 'create_task',
    args: { title: 'Steuern', date: '2026-09-22' },
  });
  assert.deepEqual(one('ich muss die garage aufräumen'), {
    name: 'create_task',
    args: { title: 'Garage aufräumen' },
  });
  assert.deepEqual(one('todo: velo putzen'), { name: 'create_task', args: { title: 'Velo putzen' } });
});

test('abhaken, löschen, verschieben — nur, wenn genau ein Eintrag passt', () => {
  assert.deepEqual(one('hab das velo geflickt'), { name: 'complete_task', args: { ref: 'A2' } });
  assert.deepEqual(one('steuererklärung erledigt'), { name: 'complete_task', args: { ref: 'A1' } });
  assert.deepEqual(one('hak die steuererklärung ab'), { name: 'complete_task', args: { ref: 'A1' } });
  assert.deepEqual(one('streich den fussball'), { name: 'delete_event', args: { ref: 'T2' } });
  assert.deepEqual(one('sag den zahnarzt ab'), { name: 'delete_event', args: { ref: 'T1' } });
  assert.deepEqual(one('verschieb den zahnarzt auf freitag'), {
    name: 'move_event',
    args: { ref: 'T1', date: '2026-09-25' },
  });
  assert.deepEqual(one('verschiebe fussball auf morgen um 7'), {
    name: 'move_event',
    args: { ref: 'T2', date: '2026-09-22', start: '19:00' },
  });
  // Unbekannt oder mehrdeutig: nichts tun, die KI fragen.
  assert.equal(say('streich das konzert'), null);
  assert.equal(say('hab was gemacht'), null);
  // „Ich habe morgen …“ ist ein Termin, kein Abhaken.
  assert.equal(one('ich habe morgen um 9 velo flicken')?.name, 'create_event');
});

test('Notiz, Wecker, hell/dunkel, öffnen', () => {
  assert.deepEqual(one('schreib auf: ideen für ferien, tessin oder engadin'), {
    name: 'create_note',
    args: { title: 'Ideen für ferien', text: 'Tessin oder engadin' },
  });
  assert.deepEqual(one('notiz: wlan passwort vom büro'), {
    name: 'create_note',
    args: { title: 'Wlan passwort vom büro' },
  });
  assert.deepEqual(one('weck mich unter der woche um halb 7'), {
    name: 'set_alarm',
    args: { time: '06:30', days: ['mo', 'di', 'mi', 'do', 'fr'] },
  });
  assert.deepEqual(one('wecker morgen um 7'), { name: 'set_alarm', args: { time: '07:00' } });
  assert.deepEqual(one('stell den wecker am samstag auf 9 uhr'), {
    name: 'set_alarm',
    args: { time: '09:00', days: ['sa'] },
  });
  assert.deepEqual(one('mach die app dunkel'), { name: 'set_theme', args: { mode: 'dark' } });
  assert.deepEqual(one('hell'), { name: 'set_theme', args: { mode: 'light' } });
  assert.equal(say('ist es draussen hell'), null);
  assert.deepEqual(one('öffne die notizen'), { name: 'open_function', args: { module: 'notes' } });
  assert.deepEqual(one('zeig mir den wecker'), { name: 'open_function', args: { module: 'alarm' } });
  // Was die App nicht hat, öffnet sie nicht.
  assert.equal(say('öffne die rechnungen'), null);
});

test('Fragen: das Programm und „wann ist …“ aus der Liste, sonst die KI', () => {
  assert.deepEqual(say('was habe ich morgen'), { kind: 'agenda', from: '2026-09-22', to: '2026-09-22' });
  assert.deepEqual(say('was steht diese woche an?'), { kind: 'agenda', from: '2026-09-21', to: '2026-09-27' });
  assert.deepEqual(say('was steht an'), { kind: 'agenda', from: '2026-09-21', to: '2026-09-27' });
  assert.deepEqual(say('hab ich am freitag was?'), { kind: 'agenda', from: '2026-09-25', to: '2026-09-25' });
  assert.deepEqual(say('wann ist der zahnarzt?'), { kind: 'when', item: ITEMS[0] });
  // Keine Frage nach dem Programm: das beantwortet die KI.
  assert.equal(say('wie wird das wetter morgen?'), null);
  assert.equal(say('was kostet ein flug nach rom'), null);
  // Ein Fragezeichen legt nie etwas an.
  assert.equal(say('morgen um 3 zahnarzt?'), null);
});

test('Gym und Geld: nur in der App, die es führt', () => {
  const gym = ['fitness', 'meals', 'sleep', 'water', 'meds', 'vitals', 'mind'];
  const money = ['budget', 'bills', 'subscriptions', 'savings'];
  assert.deepEqual(one('ich habe 5 dl getrunken', gym), { name: 'log_water', args: { dl: 5 } });
  assert.deepEqual(one('zwei gläser wasser getrunken', gym), { name: 'log_water', args: { dl: 5 } });
  assert.deepEqual(one('30 minuten joggen', gym), { name: 'log_workout', args: { kind: 'Joggen', minutes: 30 } });
  assert.deepEqual(one('20 franken für pizza ausgegeben', money), {
    name: 'add_expense',
    args: { amount: 20, category: 'food', note: 'Pizza' },
  });
  assert.deepEqual(one('CHF 3.50 für den bus bezahlt', money), {
    name: 'add_expense',
    args: { amount: 3.5, category: 'transport', note: 'Den bus' },
  });
  // In GetBetter gibt es kein Trinken.
  assert.equal(say('ich habe 5 dl getrunken'), null);
});

test('Stolperfallen: nichts raten', () => {
  assert.equal(say(''), null);
  assert.equal(say('morgen wird es regnen'), null);
  assert.equal(say('danke dir'), null);
  assert.equal(say('erzähl mir einen witz'), null);
  assert.equal(say('ich habe hunger'), null);
});

test('matchItem und rangeOf', () => {
  assert.equal(matchItem('das velo', ITEMS, ['task'])?.ref, 'A2');
  assert.equal(matchItem('essen', ITEMS, ['event'])?.ref, 'T3');
  assert.equal(matchItem('irgendwas', ITEMS, ['event']), null);
  assert.deepEqual(rangeOf('was ist am wochenende', TODAY), { from: '2026-09-26', to: '2026-09-27' });
  assert.deepEqual(rangeOf('nächste woche', TODAY), { from: '2026-09-28', to: '2026-10-04' });
});

test('whenHint: Tag und Uhrzeit fertig gerechnet für die KI', () => {
  assert.equal(
    whenHint('ich brauche nächsten mittwoch nach der arbeit einen termin beim coiffeur, so gegen sechs', TODAY),
    '→ 2026-09-23 18:00',
  );
  assert.equal(whenHint('morgen', TODAY), '→ 2026-09-22');
  assert.equal(whenHint('erzähl mir einen witz', TODAY), null);
});

test('Spannen: von 15 bis 17 Uhr, 15–17, zwischen 3 und 5, 9:30 bis 11', () => {
  assert.deepEqual(one('morgen von 15 bis 17 uhr zahnarzt'), {
    name: 'create_event',
    args: { title: 'Zahnarzt', date: '2026-09-22', start: '15:00', end: '17:00' },
  });
  assert.deepEqual(one('zahnarzt morgen 15-17'), {
    name: 'create_event',
    args: { title: 'Zahnarzt', date: '2026-09-22', start: '15:00', end: '17:00' },
  });
  assert.deepEqual(one('übermorgen zwischen 3 und 5 coiffeur'), {
    name: 'create_event',
    args: { title: 'Coiffeur', date: '2026-09-23', start: '15:00', end: '17:00' },
  });
  assert.deepEqual(one('am freitag 9:30 bis 11 meeting mit tom'), {
    name: 'create_event',
    args: { title: 'Meeting mit tom', date: '2026-09-25', start: '09:30', end: '11:00' },
  });
  assert.deepEqual(one('termin ab 15 uhr bei der bank morgen'), {
    name: 'create_event',
    args: { title: 'Bank', date: '2026-09-22', start: '15:00' },
  });
  assert.deepEqual(one('verschieb den zahnarzt auf freitag von 10 bis 12'), {
    name: 'move_event',
    args: { ref: 'T1', date: '2026-09-25', start: '10:00', end: '12:00' },
  });
  assert.equal(whenHint('morgen von 15 bis 17 uhr zahnarzt', TODAY), '→ 2026-09-22 15:00–17:00');
});

test('Zerlegen statt raten: was die App nicht ganz versteht, versteht die KI', () => {
  assert.equal(say('morgen um 3 zahnarzt, dauert 2 stunden'), null);
  assert.equal(say('erinner mich jeden zweiten montag an den müll'), null);
  // „2-3 Stunden“ ist keine Uhrzeit.
  assert.equal(say('morgen 2-3 stunden velo fahren'), null);
});

test('„lösche meinen Termin morgen“ — nie ein neuer Termin', () => {
  // Der Fehler von vorher: der Satz wurde ein Termin mit diesem Namen.
  for (const text of [
    'lösche meinen termin morgen',
    'Lösche meinen Termin morgen',
    'kannst du meinen termin morgen löschen?',
    'bitte meinen termin morgen löschen',
    'streich den termin morgen',
    'sag meinen termin morgen ab',
    'lösch das konzert am freitag',
    'verschieb meinen termin morgen auf freitag',
  ]) {
    assert.equal(creates(sayWith(text, TOMORROW)), false, text);
    assert.equal(creates(say(text)), false, text);
  }
  // Morgen genau ein Termin: der ist gemeint.
  const one = TOMORROW.filter((item) => item.ref !== 'T2');
  assert.deepEqual(sayWith('lösche meinen termin morgen', one), {
    kind: 'actions',
    actions: [{ name: 'delete_event', args: { ref: 'T1' } }],
    sure: true,
  });
  // Zwei: nachfragen statt raten.
  assert.deepEqual(sayWith('lösche meinen termin morgen', TOMORROW), {
    kind: 'pick',
    pending: { command: 'delete', from: '2026-09-22', to: '2026-09-22' },
  });
  // Keiner: auch nachfragen (die App sagt, dass da keiner ist).
  assert.deepEqual(say('lösche meinen termin morgen'), {
    kind: 'pick',
    pending: { command: 'delete', from: '2026-09-22', to: '2026-09-22' },
  });
  // Name, Tag oder Uhrzeit machen es eindeutig.
  assert.deepEqual(sayWith('kannst du den zahnarzt morgen löschen?', TOMORROW), {
    kind: 'actions',
    actions: [{ name: 'delete_event', args: { ref: 'T2' } }],
    sure: true,
  });
  assert.equal(sayWith('lösch den termin morgen um 10', TOMORROW)?.kind, 'actions');
  assert.deepEqual(sayWith('verschieb meinen termin übermorgen auf freitag um 19 uhr', TOMORROW), {
    kind: 'actions',
    actions: [{ name: 'move_event', args: { ref: 'T3', date: '2026-09-25', start: '19:00' } }],
    sure: true,
  });
  assert.deepEqual(sayWith('verschieb meinen termin morgen auf freitag', TOMORROW), {
    kind: 'pick',
    pending: { command: 'move', from: '2026-09-22', to: '2026-09-22', change: { date: '2026-09-25' } },
  });
});

test('die Antwort auf „Welchen meinst du?“', () => {
  const remove: Pending = { command: 'delete', from: '2026-09-22', to: '2026-09-22' };
  const deleted = (ref: string): Understood => ({
    kind: 'actions',
    actions: [{ name: 'delete_event', args: { ref } }],
    sure: true,
  });
  assert.deepEqual(sayWith('den zahnarzt', TOMORROW, remove), deleted('T2'));
  assert.deepEqual(sayWith('coiffeur', TOMORROW, remove), deleted('T1'));
  assert.deepEqual(sayWith('den um 10', TOMORROW, remove), deleted('T1'));
  assert.deepEqual(sayWith('den ersten', TOMORROW, remove), deleted('T1'));
  assert.deepEqual(sayWith('den letzten', TOMORROW, remove), deleted('T2'));
  // Nur aus dem Tag, nach dem gefragt war.
  assert.notDeepEqual(sayWith('fussball', TOMORROW, remove), deleted('T3'));
  const move: Pending = { ...remove, command: 'move', change: { date: '2026-09-25' } };
  assert.deepEqual(sayWith('den zahnarzt', TOMORROW, move), {
    kind: 'actions',
    actions: [{ name: 'move_event', args: { ref: 'T2', date: '2026-09-25' } }],
    sure: true,
  });
});

test('commandOf und pendingOf: was löschen, verschieben oder abhaken will', () => {
  assert.equal(commandOf('lösche meinen termin morgen')?.command, 'delete');
  assert.equal(commandOf('kannst du bitte den zahnarzt absagen?')?.command, 'delete');
  assert.equal(commandOf('verschieb den zahnarzt auf freitag')?.target, 'freitag');
  assert.equal(commandOf('den zahnarzt auf freitag verschieben')?.command, 'move');
  assert.equal(commandOf('steuererklärung erledigt')?.command, 'complete');
  // Anlegen ist kein Befehl an Bestehendem — auch mit „löschen“ oder „streichen“ darin.
  assert.equal(commandOf('erinnere mich die alten fotos zu löschen'), null);
  assert.equal(commandOf('morgen wand streichen'), null);
  assert.equal(commandOf('bis freitag muss die steuererklärung erledigt sein'), null);
  assert.deepEqual(pendingOf('lösche meinen termin morgen', TODAY), {
    command: 'delete',
    from: '2026-09-22',
    to: '2026-09-22',
  });
  assert.deepEqual(pendingOf('lösch den termin', TODAY), { command: 'delete', from: TODAY, to: '2026-10-04' });
  assert.equal(pendingOf('verschieb den zahnarzt', TODAY), null);
  assert.equal(pendingOf('trag morgen zahnarzt ein', TODAY), null);
});

test('sicher ist nur, was an den Daten nachgeprüft ist', () => {
  const sureOf = (text: string) => {
    const result = say(text);
    return result?.kind === 'actions' ? result.sure : null;
  };
  assert.equal(sureOf('streich den fussball'), true);
  assert.equal(sureOf('hab das velo geflickt'), true);
  assert.equal(sureOf('mach die app dunkel'), true);
  assert.equal(sureOf('öffne die notizen'), true);
  assert.equal(sureOf('ich muss morgen um 3 zum coiffeur'), false);
  assert.equal(sureOf('notiz: wlan passwort'), false);
  // „Kannst du mir … eintragen?“ ist keine Frage nach dem Programm.
  assert.equal(say('kannst du mir morgen um 3 einen termin beim zahnarzt eintragen?'), null);
  // „Wand streichen“ ist malen, nicht löschen.
  assert.equal(one('morgen wand streichen')?.name, 'create_event');
});
