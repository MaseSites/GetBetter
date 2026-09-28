import assert from 'node:assert/strict';
import { test } from 'node:test';

import { dueDayOf } from '../../db/taskFields';

import { cleanSubject, MAX_SUBJECT, taskFromMail } from './toTask';

const NOW = new Date(2026, 8, 23, 21, 45);
const FROM = { name: 'Jonas Muster', address: 'jonas@beispiel.ch' };

function mail(subject: string, from = FROM) {
  return { id: 'msg_1', subject, from };
}

test('taskFromMail: Titel, Notiz mit Absender und Link, fällig heute', () => {
  const draft = taskFromMail(mail('Offerte Maler'), NOW);
  assert.equal(draft.title, 'Antworten: Offerte Maler');
  assert.equal(draft.notes, 'Von Jonas Muster <jonas@beispiel.ch>\n/run/mail?message=msg_1');
  assert.equal(draft.dueDay, '2026-09-23');
  assert.equal(dueDayOf({ dueAt: draft.dueAt }), '2026-09-23');
  assert.equal(draft.link, '/run/mail?message=msg_1');
});

test('taskFromMail: Präfixe fallen weg, auch mehrfach und gemischt', () => {
  assert.equal(taskFromMail(mail('Re: Offerte'), NOW).title, 'Antworten: Offerte');
  assert.equal(taskFromMail(mail('AW: RE: Offerte'), NOW).title, 'Antworten: Offerte');
  assert.equal(taskFromMail(mail('Fwd: WG: Znacht am Freitag'), NOW).title, 'Antworten: Znacht am Freitag');
  assert.equal(cleanSubject('Re[2]: Rechnung'), 'Rechnung');
  assert.equal(cleanSubject('TR:Réunion'), 'Réunion');
  assert.equal(cleanSubject('SV: Möte'), 'Möte');
  // „Rechnung“ beginnt nicht mit „Re:“ — bleibt ganz.
  assert.equal(cleanSubject('Reise nach Rom'), 'Reise nach Rom');
});

test('taskFromMail: leerer Betreff und nur Präfix', () => {
  assert.equal(taskFromMail(mail(''), NOW).title, 'Antworten: Ohne Betreff');
  assert.equal(taskFromMail(mail('  Re:  '), NOW).title, 'Antworten: Ohne Betreff');
});

test('taskFromMail: lange Betreffe werden gekürzt', () => {
  const long = 'Wort '.repeat(40);
  const subject = cleanSubject(long);
  assert.ok(subject.length <= MAX_SUBJECT);
  assert.ok(subject.endsWith('…'));
  assert.equal(cleanSubject('a'.repeat(MAX_SUBJECT)), 'a'.repeat(MAX_SUBJECT));
});

test('taskFromMail: Absender ohne Namen, ohne alles; eigene Sätze', () => {
  assert.match(taskFromMail(mail('X', { name: '', address: 'a@b.ch' }), NOW).notes, /^Von a@b\.ch\n/u);
  assert.equal(taskFromMail(mail('X', { name: '', address: '' }), NOW).notes, '/run/mail?message=msg_1');
  const english = taskFromMail(mail(''), NOW, {
    title: 'Reply: {subject}',
    noSubject: 'No subject',
    from: 'From {sender}',
  });
  assert.equal(english.title, 'Reply: No subject');
  assert.match(english.notes, /^From Jonas/u);
});

test('taskFromMail: die Id landet sicher im Link', () => {
  assert.equal(
    taskFromMail({ id: 'a b&c', subject: 'X', from: FROM }, NOW).link,
    '/run/mail?message=a%20b%26c',
  );
});
