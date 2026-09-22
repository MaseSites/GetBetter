import assert from 'node:assert/strict';
import { test } from 'node:test';

import type { AiAction, AiContextItem } from '../../db/ai';
import { vetActions } from './vet';

// Montag, 21. September 2026.
const TODAY = '2026-09-21';
const ITEMS: AiContextItem[] = [
  { ref: 'T1', kind: 'event', title: 'Coiffeur', date: '2026-09-22', time: '10:00' },
  { ref: 'T2', kind: 'event', title: 'Zahnarzt', date: '2026-09-23', time: '14:00' },
];

const vet = (text: string, actions: AiAction[]) => vetActions(actions, { text, today: TODAY, items: ITEMS });
const event = (title: string): AiAction => ({ name: 'create_event', args: { title, date: '2026-09-22' } });

test('ein Befehl zum Löschen legt nie etwas an', () => {
  // Genau der Fehler: „lösche meinen termin morgen“ wurde ein Termin mit diesem Namen.
  assert.deepEqual(vet('lösche meinen termin morgen', [event('Lösche meinen Termin')]), { actions: [], dropped: 1 });
  assert.deepEqual(vet('kannst du meinen termin morgen löschen?', [event('Termin')]), { actions: [], dropped: 1 });
  assert.equal(vet('verschieb den coiffeur auf freitag', [event('Coiffeur')]).dropped, 1);
  assert.equal(vet('hak die steuern ab', [{ name: 'create_task', args: { title: 'Steuern' } }]).dropped, 1);
});

test('ein nachgeplapperter Befehl ist kein Titel — ein echter bleibt', () => {
  assert.equal(vet('trag mir morgen coiffeur ein', [event('Trag mir Coiffeur ein')]).dropped, 1);
  assert.equal(
    vet('bitte einkaufen: milch', [{ name: 'add_shopping', args: { items: ['Bitte Milch'] } }]).dropped,
    1,
  );
  assert.deepEqual(vet('trag mir morgen coiffeur ein', [event('Coiffeur')]).dropped, 0);
  // „Streichen“ ist auch malen — ohne Befehl im Satz bleibt der Titel.
  assert.equal(vet('morgen wand streichen', [event('Wand streichen')]).dropped, 0);
  // Erinnern heisst anlegen, auch mit „löschen“ darin.
  assert.equal(
    vet('erinnere mich die alten fotos zu löschen', [{ name: 'create_task', args: { title: 'Alte Fotos löschen' } }])
      .dropped,
    0,
  );
});

test('„lösch meinen Termin morgen“ löscht nur einen Termin von morgen', () => {
  const remove = (ref: string): AiAction => ({ name: 'delete_event', args: { ref } });
  assert.deepEqual(vet('lösche meinen termin morgen', [remove('T1')]), { actions: [remove('T1')], dropped: 0 });
  assert.deepEqual(vet('lösche meinen termin morgen', [remove('T2')]), { actions: [], dropped: 1 });
  assert.equal(vet('lösch den zahnarzt', [remove('T2')]).dropped, 0);
  // Ohne Befehl im Satz (Antwort auf eine Rückfrage) gilt, was die KI wählt.
  assert.equal(vet('den zahnarzt', [remove('T2')]).dropped, 0);
});
