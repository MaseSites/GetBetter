import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  foldText,
  GROUP_PREVIEW,
  rankResults,
  scoreCandidate,
  type SearchCandidate,
  type SearchGroup,
} from './results';

function candidate(
  key: string,
  group: SearchGroup,
  title: string,
  extra: readonly string[] = [],
): SearchCandidate<string> {
  return { key, group, title, extra, item: key };
}

test('foldText ignoriert Gross, klein und Akzente', () => {
  assert.equal(foldText('Ämtli Café'), 'amtli cafe');
});

test('scoreCandidate: Titel schlaegt Text, Anfang schlaegt Mitte', () => {
  const exact = scoreCandidate('physio', 'Physio');
  const prefix = scoreCandidate('phys', 'Physio anrufen');
  const word = scoreCandidate('anruf', 'Physio anrufen');
  const inside = scoreCandidate('hysi', 'Physio');
  const extraWord = scoreCandidate('luca', 'Termin', ['Call mit Luca']);
  const extraInside = scoreCandidate('uca', 'Termin', ['Call mit Luca']);

  assert.ok(exact > prefix);
  assert.ok(prefix > word);
  assert.ok(word > inside);
  assert.ok(inside > extraWord);
  assert.ok(extraWord > extraInside);
  assert.ok(extraInside > 0);
});

test('scoreCandidate findet mehrere Woerter in beliebiger Reihenfolge', () => {
  assert.ok(scoreCandidate('maler offerte', 'Offerte Maler prüfen') > 0);
  assert.ok(scoreCandidate('offerte anna', 'Offerte', ['von Anna']) > 0);
  assert.equal(scoreCandidate('maler zahnarzt', 'Offerte Maler prüfen'), 0);
});

test('scoreCandidate: leere Suche und fehlende Felder treffen nichts', () => {
  assert.equal(scoreCandidate('  ', 'Physio'), 0);
  assert.equal(scoreCandidate('x', 'Physio', [null, undefined, '']), 0);
});

test('rankResults gibt ohne Eingabe nichts', () => {
  assert.deepEqual(rankResults('', [candidate('a', 'tasks', 'A')]), { best: null, groups: [] });
});

test('rankResults stellt den besten Treffer nach oben und nicht nochmals in die Gruppe', () => {
  const results = rankResults('maler', [
    candidate('t1', 'tasks', 'Offerte Maler prüfen'),
    candidate('n1', 'notes', 'Maler'),
    candidate('m1', 'mail', 'Rechnung', ['Maler Müller AG']),
  ]);

  assert.equal(results.best?.key, 'n1');
  assert.deepEqual(
    results.groups.map((group) => group.group),
    ['tasks', 'mail'],
  );
  assert.ok(results.groups.every((group) => group.hits.every((hit) => hit.key !== 'n1')));
});

test('rankResults haelt die feste Reihenfolge der Gruppen', () => {
  const results = rankResults('a', [
    candidate('f', 'functions', 'Aufgaben'),
    candidate('p', 'places', 'Aarau'),
    candidate('pe', 'people', 'Anna'),
    candidate('m', 'mail', 'Abo'),
    candidate('n', 'notes', 'Auto'),
    candidate('t', 'tasks', 'Anrufen'),
    candidate('e', 'entries', 'Apfel'),
    candidate('best', 'functions', 'a'),
  ]);

  assert.equal(results.best?.key, 'best');
  assert.deepEqual(
    results.groups.map((group) => group.group),
    ['tasks', 'notes', 'mail', 'people', 'places', 'entries', 'functions'],
  );
});

test('rankResults zeigt je Gruppe drei und zaehlt alle', () => {
  const mails = Array.from({ length: 5 }, (_, index) =>
    candidate(`m${index}`, 'mail', `Newsletter ${index}`),
  );
  const results = rankResults('news', [candidate('best', 'tasks', 'News'), ...mails]);
  const mail = results.groups.find((group) => group.group === 'mail');

  assert.equal(mail?.total, 5);
  assert.equal(mail?.hits.length, GROUP_PREVIEW);
  // Bei gleichem Wert bleibt die Reihenfolge, in der die Eintraege kamen.
  assert.deepEqual(
    mail?.hits.map((hit) => hit.key),
    ['m0', 'm1', 'm2'],
  );
});

test('rankResults klappt eine Gruppe ganz auf', () => {
  const mails = Array.from({ length: 5 }, (_, index) =>
    candidate(`m${index}`, 'mail', `Newsletter ${index}`),
  );
  const results = rankResults('news', [candidate('best', 'tasks', 'News'), ...mails], ['mail']);

  assert.equal(results.groups.find((group) => group.group === 'mail')?.hits.length, 5);
});

test('rankResults sortiert in einer Gruppe nach Wert', () => {
  const results = rankResults('anna', [
    candidate('best', 'tasks', 'Anna'),
    candidate('inside', 'people', 'Marianna'),
    candidate('word', 'people', 'Lisa Anna'),
    candidate('prefix', 'people', 'Annabelle'),
  ]);

  assert.deepEqual(
    results.groups[0]?.hits.map((hit) => hit.key),
    ['prefix', 'word', 'inside'],
  );
});
