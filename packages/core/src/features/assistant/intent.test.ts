import assert from 'node:assert/strict';
import { test } from 'node:test';

import { intentOf } from './intent';

test('die Vorschlaege aus allen vier Sprachen kommen an', () => {
  assert.deepEqual(intentOf('Milch auf die Einkaufsliste'), { kind: 'shopping', subject: 'Milch' });
  assert.deepEqual(intentOf('Bad putzen zu den Ämtli'), { kind: 'chore', subject: 'Bad putzen' });

  assert.deepEqual(intentOf('Add milk to the shopping list'), {
    kind: 'shopping',
    subject: 'milk',
  });
  assert.deepEqual(intentOf('Add cleaning the bathroom to chores'), {
    kind: 'chore',
    subject: 'cleaning the bathroom',
  });

  assert.deepEqual(intentOf('Du lait sur la liste de courses'), {
    kind: 'shopping',
    subject: 'Du lait',
  });
  assert.deepEqual(intentOf('Nettoyer la salle de bain dans les tâches ménagères'), {
    kind: 'chore',
    subject: 'Nettoyer la salle de bain',
  });

  assert.deepEqual(intentOf('Latte nella lista della spesa'), {
    kind: 'shopping',
    subject: 'Latte',
  });
  assert.deepEqual(intentOf('Pulire il bagno nelle faccende'), {
    kind: 'chore',
    subject: 'Pulire il bagno',
  });
});

test('Fuellwoerter vorne und hinten fallen weg', () => {
  assert.deepEqual(intentOf('Kannst du mir 2 Bananen auf die Einkaufsliste setzen?'), {
    kind: 'shopping',
    subject: '2 Bananen',
  });
  assert.deepEqual(intentOf('Bitte Brot auf meine Einkaufsliste!'), {
    kind: 'shopping',
    subject: 'Brot',
  });
  assert.deepEqual(intentOf('Please put eggs on my shopping list.'), {
    kind: 'shopping',
    subject: 'eggs',
  });
  assert.deepEqual(intentOf('Aggiungi pane alla lista della spesa'), {
    kind: 'shopping',
    subject: 'pane',
  });
});

test('was kein Auftrag ist, bleibt liegen', () => {
  assert.equal(intentOf(''), null);
  assert.equal(intentOf('Wie wird das Wetter morgen?'), null);
  assert.equal(intentOf('What’s on today?'), null);
  // Nur das Ziel, aber nichts, was darauf soll.
  assert.equal(intentOf('Auf die Einkaufsliste'), null);
});
