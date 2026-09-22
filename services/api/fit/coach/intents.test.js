const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const { detectIntent } = require('./intents.js');

// Montag
const TODAY = '2026-09-21';

describe('Absichten des Coaches', () => {
  test('das Beispiel aus dem Plan', () => {
    assert.deepEqual(detectIntent('Ich will heute nicht trainieren. Verschiebe das Training auf morgen.', TODAY), {
      tool: 'reschedule_workout',
      args: { fromDay: '2026-09-21', toDay: '2026-09-22' },
    });
  });

  test('verschieben in vier Sprachen, auch auf einen Wochentag', () => {
    const toDay = (text) => detectIntent(text, TODAY).args?.toDay;
    assert.equal(toDay('Kannst du mein Training auf Freitag verschieben?'), '2026-09-25');
    assert.equal(toDay('Move my workout to Wednesday'), '2026-09-23');
    assert.equal(toDay("Déplace l'entraînement à demain"), '2026-09-22');
    assert.equal(toDay("Sposta l'allenamento a dopodomani"), '2026-09-23');
    assert.equal(toDay('Heute keine Lust auf Training'), '2026-09-22');
  });

  test('Gewicht, Plan, Liste, Vorrat, Vorschlaege', () => {
    assert.deepEqual(detectIntent('Ich wiege heute 79,4 kg', TODAY), { tool: 'log_weight', args: { weightKg: 79.4 } });
    assert.equal(detectIntent('Erstell mir einen Wochenplan', TODAY).tool, 'create_weekly_meal_plan');
    assert.equal(detectIntent('Mach die Einkaufsliste', TODAY).tool, 'generate_shopping_list');
    assert.equal(detectIntent('Ich habe Bananen, Mehl und Eier zu Hause', TODAY).tool, 'pantry_text');
    assert.equal(detectIntent('Was kann ich damit kochen?', TODAY).tool, 'suggest_recipes_from_pantry');
    assert.equal(detectIntent('Was soll ich heute Abend essen?', TODAY).tool, 'find_meals_for_remaining_macros');
    assert.equal(detectIntent('Wie viel darf ich heute noch essen?', TODAY).tool, 'get_remaining_macros');
    assert.equal(detectIntent('Wie läuft mein Fortschritt?', TODAY).tool, 'explain_progress');
  });

  test('Schmerzen: keine Diagnose, keine Aktion', () => {
    assert.deepEqual(detectIntent('Mein Knie tut weh, soll ich trotzdem trainieren?', TODAY), { tool: 'general', safety: true });
  });

  test('alles andere ist eine freie Frage', () => {
    assert.deepEqual(detectIntent('Warum ist Eiweiss wichtig?', TODAY), { tool: 'general' });
  });
});

describe('Absichten des Coaches, genauer', () => {
  test('Gewicht nur mit Wiege-Woertern, nie aus dem Training — in vier Sprachen', () => {
    assert.deepEqual(detectIntent('Mein Gewicht heute: 81,2 kg', TODAY), { tool: 'log_weight', args: { weightKg: 81.2 } });
    assert.deepEqual(detectIntent('I weigh 80 kg today', TODAY), { tool: 'log_weight', args: { weightKg: 80 } });
    assert.deepEqual(detectIntent('Je pèse 70,5 kg', TODAY), { tool: 'log_weight', args: { weightKg: 70.5 } });
    assert.deepEqual(detectIntent('Oggi peso 65 kg', TODAY), { tool: 'log_weight', args: { weightKg: 65 } });
    assert.equal(detectIntent('Ich habe 80 kg gedrückt', TODAY).tool, 'general');
    assert.equal(detectIntent('80 kg beim Bankdrücken, 3 Sätze', TODAY).tool, 'general');
    assert.equal(detectIntent('I benched 80 kg today', TODAY).tool, 'general');
    assert.equal(detectIntent("J'ai fait 100 kg au soulevé de terre", TODAY).tool, 'general');
    assert.equal(detectIntent('Ho fatto 60 kg di panca', TODAY).tool, 'general');
    assert.equal(detectIntent('Wie viel kg sind 5 Pfund?', TODAY).tool, 'general');
  });

  test('„von … auf …“ nimmt den richtigen Tag, in vier Sprachen', () => {
    const args = (text) => detectIntent(text, TODAY).args;
    assert.deepEqual(args('Verschieb Freitag auf Samstag'), { fromDay: '2026-09-25', toDay: '2026-09-26' });
    assert.deepEqual(args('Verschiebe das Training vom Freitag auf Samstag'), { fromDay: '2026-09-25', toDay: '2026-09-26' });
    assert.deepEqual(args('Move my workout from Friday to Saturday'), { fromDay: '2026-09-25', toDay: '2026-09-26' });
    assert.deepEqual(args("Déplace la séance de vendredi à samedi"), { fromDay: '2026-09-25', toDay: '2026-09-26' });
    assert.deepEqual(args("Sposta l'allenamento da venerdì a sabato"), { fromDay: '2026-09-25', toDay: '2026-09-26' });
    assert.deepEqual(args('Verschieb das Training auf morgen'), { fromDay: TODAY, toDay: '2026-09-22' });
  });

  test('Woerter gelten ganz', () => {
    // „oggigiorno“ ist nicht „oggi“, „morgens“ nicht „morgen“.
    assert.equal(detectIntent("Sposta l'allenamento, oggigiorno è troppo", TODAY).args.toDay, '2026-09-22');
    assert.equal(detectIntent('Ho fame', TODAY).tool, 'pantry_text');
    assert.equal(detectIntent('Hotel oder Zuhause?', TODAY).tool, 'general');
  });

  test('auslassen und Rekorde', () => {
    assert.deepEqual(detectIntent('Ich lasse das Training heute aus', TODAY), { tool: 'skip_workout', args: { day: TODAY } });
    assert.deepEqual(detectIntent("Skip tomorrow's workout", TODAY), { tool: 'skip_workout', args: { day: '2026-09-22' } });
    assert.equal(detectIntent("Annule l'entraînement de demain", TODAY).tool, 'skip_workout');
    assert.equal(detectIntent("Salta l'allenamento di oggi", TODAY).tool, 'skip_workout');
    assert.equal(detectIntent('Was sind meine Rekorde?', TODAY).tool, 'get_records');
    assert.equal(detectIntent('Show my personal bests', TODAY).tool, 'get_records');
    assert.equal(detectIntent('Mes records ?', TODAY).tool, 'get_records');
    assert.equal(detectIntent('I miei primati', TODAY).tool, 'get_records');
  });
});
