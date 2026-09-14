/**
 * Der Router ist rein: jede Regel, jede App, vier Sprachen — ohne Modell.
 */
const assert = require('node:assert/strict');
const { describe, test } = require('node:test');

const {
  APPS,
  COST_LEVELS,
  KEYWORDS,
  LONG_CONVERSATION,
  LONG_HISTORY,
  LONG_INPUT,
  MAX_CHARS,
  SHORT_TEXT,
  TIERS,
  normalise,
  routeRequest,
} = require('./router.js');

const route = (app, text, extra = {}) => routeRequest({ app, text, ...extra });
const intentOf = (app, text, extra) => route(app, text, extra).intent;
const tierOf = (app, text, extra) => route(app, text, extra).tier;

/** Saetze ohne Schluesselwort, genau `length` Zeichen, ohne Leerraum am Ende. */
const chatter = (length) =>
  `${'Ich erzähle dir von meinem Tag am See. '.repeat(40).slice(0, length - 1)}.`;

describe('KI-Router', () => {
  test('normalise: klein, Umlaute ausgeschrieben, Akzente weg, Leerraum zusammen', () => {
    assert.equal(normalise('  Ämtli FÜR   Café, Größe'), 'aemtli fuer cafe, groesse');
    assert.equal(normalise('Plan d’entraînement'), "plan d'entrainement");
    assert.equal(normalise('Qualità  perché'), 'qualita perche');
    assert.equal(normalise(undefined), '');
  });

  test('jede Schluesselwort-Tabelle hat alle vier Sprachen und nur RegExp', () => {
    for (const [name, table] of Object.entries(KEYWORDS)) {
      for (const language of ['de', 'en', 'fr', 'it']) {
        assert.ok(Array.isArray(table[language]), `${name}.${language}`);
        assert.ok(table[language].length > 0, `${name}.${language} leer`);
      }
      for (const pattern of Object.values(table).flat()) {
        assert.ok(pattern instanceof RegExp, `${name}: ${pattern}`);
        assert.equal(pattern.global, false, `${name}: /g waere zustandsbehaftet`);
      }
    }
  });

  describe('Absichten in vier Sprachen', () => {
    const samples = {
      command: [
        'Trag morgen Zahnarzt um 10 Uhr ein',
        'Bitte setz einen Wecker auf 6:30',
        'Zeig mir meine Aufgaben für heute',
        'Lösch den Termin am Freitag',
        "Erinner mi am Mäntig a d'Rechnig",
        'Tue das uf d Poschtiliste',
        'Remind me to call mom at 6',
        'Turn on the alarm for tomorrow',
        'Ajoute du lait à la liste',
        'Rappelle-moi la réunion demain',
        'Aggiungi latte alla lista della spesa',
        'Ricordami di chiamare Luca',
      ],
      simple_query: [
        'Wie viele Kalorien hat eine Banane?',
        'Rechne 12 * 7',
        'Wie vill Kalorie het en Öpfel?',
        'Was ist 15 Prozent von 80?',
        '12 + 30',
        'Wann ist Ostern?',
        'How many calories are in an apple?',
        'Calculate 3 times 4',
        'Combien de calories dans une pomme ?',
        'Quelle heure est-il à Tokyo ?',
        'Quante calorie ha una mela?',
        'Quanto fa 7 per 8?',
      ],
      coaching: [
        'Gib mir Tipps, wie ich morgens früher aufstehe',
        'Motivier mich fürs Training',
        'Hesch mer es paar Tipps fürs Joggä?',
        'Wie schaffe ich es, dranzubleiben?',
        'Any tips to sleep better?',
        'How can I improve my running?',
        'Des conseils pour mieux dormir ?',
        'Motive-moi pour aller courir',
        'Dammi qualche consiglio per dormire meglio',
        'Come posso migliorare la mia resistenza?',
      ],
      planning: [
        'Erstelle mir einen Trainingsplan für 4 Wochen',
        'Mach mir einen Wochenplan',
        'Vergleiche Python und Rust Schritt für Schritt',
        'Analysiere meine Ausgaben',
        'Ich brauche einen neuen Ernährungsplan',
        'Create a 12-week marathon training plan',
        'Compare these two offers',
        "Fais-moi un plan d'entraînement pour courir 10 km",
        'Explique la stratégie étape par étape',
        'Crea un piano di allenamento per la settimana',
        'Analizza le mie spese',
      ],
      conversation: [
        'Wie war dein Tag?',
        'Ich fühle mich heute ein bisschen müde.',
        'Erzähl mir etwas über Rom',
        'Tell me a story about a dragon',
        "Qu'est-ce que tu penses de la pluie ?",
        'Che bella giornata oggi',
      ],
    };

    for (const [intent, texts] of Object.entries(samples)) {
      test(intent, () => {
        for (const text of texts) {
          assert.equal(intentOf('bettergym', text), intent, text);
        }
      });
    }

    test('vision gewinnt immer, sobald ein Bild dabei ist', () => {
      for (const app of APPS) {
        assert.equal(intentOf(app, 'Trag das ein', { hasImage: true }), 'vision');
        assert.equal(intentOf(app, '', { hasImage: true }), 'vision');
      }
      assert.equal(intentOf('getbetter', 'Was ist das?', { hasImage: 'ja' }), 'conversation');
    });
  });

  describe('Reihenfolge der Regeln', () => {
    test('ein Plan als Wort ist ein Auftrag, wenn der Satz mit dem Verb beginnt', () => {
      assert.equal(intentOf('bettergym', 'Zeig mir den Trainingsplan'), 'command');
      assert.equal(intentOf('bettergym', 'Show my workout plan'), 'command');
      assert.equal(intentOf('bettergym', 'Brauche einen Trainingsplan'), 'planning');
    });

    test('eindeutige Planung schlaegt das Verb am Anfang', () => {
      assert.equal(intentOf('bettergym', 'Erstelle einen Plan für die Woche'), 'planning');
      assert.equal(intentOf('betterai', 'Zeig mir Schritt für Schritt, wie das geht'), 'planning');
    });

    test('Coaching schlaegt den Auftrag', () => {
      assert.equal(intentOf('getbetter', 'Zeig mir Tipps zum Schlafen'), 'coaching');
    });

    test('Auftraege und Rechnen gelten nur fuer kurze Texte', () => {
      const long = `Trag ein ${'x'.repeat(SHORT_TEXT)}`;
      assert.equal(intentOf('getbetter', long), 'conversation');
      const sum = `12 + 30 ${'und so weiter '.repeat(20)}`;
      assert.ok(sum.length > SHORT_TEXT);
      assert.equal(intentOf('getbetter', sum), 'conversation');
      assert.equal(intentOf('getbetter', `Wann ${'genau '.repeat(20)}?`), 'conversation');
    });

    test('lange Eingaben werden nur in BetterAi und BetterGym zur Planung', () => {
      const text = chatter(LONG_INPUT + 1);
      assert.equal(intentOf('betterai', text), 'planning');
      assert.equal(intentOf('bettergym', text), 'planning');
      assert.equal(intentOf('getbetter', text), 'conversation');
      assert.equal(intentOf('betterfamily', text), 'conversation');
      assert.equal(intentOf('bettermoney', text), 'conversation');
      assert.equal(intentOf('betterai', chatter(LONG_INPUT)), 'conversation');
    });
  });

  describe('Stufen je App', () => {
    test('vision -> vision_model, command und simple_query -> cheap_model, in jeder App', () => {
      for (const app of APPS) {
        assert.equal(tierOf(app, 'Was ist das?', { hasImage: true }), 'vision_model', app);
        assert.equal(tierOf(app, 'Trag Milch ein'), 'cheap_model', app);
        assert.equal(tierOf(app, 'Rechne 12 * 7'), 'cheap_model', app);
      }
    });

    test('coaching -> chat_model, in jeder App', () => {
      for (const app of APPS) assert.equal(tierOf(app, 'Gib mir Tipps'), 'chat_model', app);
    });

    test('planning -> reasoning_model nur in BetterAi und BetterGym', () => {
      const text = 'Erstelle einen Trainingsplan';
      assert.equal(tierOf('betterai', text), 'reasoning_model');
      assert.equal(tierOf('bettergym', text), 'reasoning_model');
      assert.equal(tierOf('getbetter', text), 'chat_model');
      assert.equal(tierOf('betterfamily', 'Plan für die Ferien'), 'chat_model');
      assert.equal(tierOf('bettermoney', 'Analysiere meine Ausgaben'), 'chat_model');
    });

    test('BetterGym: Plaene denken, Kalorien rechnen guenstig, Coaching chattet', () => {
      assert.equal(tierOf('bettergym', 'Mach mir einen Ernährungsplan'), 'reasoning_model');
      assert.equal(tierOf('bettergym', 'Wie viele Kalorien hat ein Apfel?'), 'cheap_model');
      assert.equal(tierOf('bettergym', 'Motivier mich'), 'chat_model');
      assert.equal(tierOf('bettergym', 'Ich bin heute müde'), 'chat_model');
    });

    test('BetterAi: Gespraech chattet, Planung denkt', () => {
      assert.equal(tierOf('betterai', 'Erzähl mir etwas über Rom'), 'chat_model');
      assert.equal(tierOf('betterai', 'Vergleiche Rom und Paris'), 'reasoning_model');
    });

    test('leichte Apps: Gespraech guenstig, bis Text oder Verlauf lang werden', () => {
      for (const app of ['getbetter', 'betterfamily', 'bettermoney']) {
        assert.equal(tierOf(app, 'Wie war dein Tag?'), 'cheap_model', app);
        assert.equal(tierOf(app, chatter(LONG_CONVERSATION)), 'cheap_model', app);
        assert.equal(tierOf(app, chatter(LONG_CONVERSATION + 1)), 'chat_model', app);
        assert.equal(
          tierOf(app, 'Wie war dein Tag?', { historyLength: LONG_HISTORY }),
          'cheap_model',
          app,
        );
        assert.equal(
          tierOf(app, 'Wie war dein Tag?', { historyLength: LONG_HISTORY + 1 }),
          'chat_model',
          app,
        );
      }
    });

    test('Gespraech in BetterGym und BetterAi -> chat_model, auch kurz', () => {
      assert.equal(tierOf('bettergym', 'Hallo du'), 'chat_model');
      assert.equal(tierOf('betterai', 'Hallo du'), 'chat_model');
    });

    test('in GetBetter landen typische Nachrichten meist guenstig', () => {
      const typical = [
        'Trag morgen Zahnarzt ein',
        'Was steht heute an?',
        'Zeig meine Aufgaben',
        'Erinnere mich an den Müll',
        'Wie viele Tage bis Weihnachten?',
        'Danke dir!',
        'Setz einen Wecker auf 7',
        'Wann hat Anna Geburtstag?',
        'Gib mir Tipps für mehr Fokus',
        'Mach mir einen Wochenplan',
      ];
      const cheap = typical.filter((text) => tierOf('getbetter', text) === 'cheap_model');
      assert.ok(cheap.length >= 8, `nur ${cheap.length} von 10 guenstig`);
    });

    test('eine unbekannte App bekommt nie die teure Stufe', () => {
      assert.equal(tierOf('fremd', 'Erstelle einen Trainingsplan'), 'chat_model');
      assert.equal(tierOf('fremd', 'Hallo'), 'chat_model');
    });
  });

  describe('Laenge, Vorlesen und Kosten', () => {
    test('maxChars je Stufe, mit und ohne Stimme', () => {
      const cases = [
        ['cheap_model', 'Trag Milch ein', {}],
        ['chat_model', 'Gib mir Tipps', {}],
        ['reasoning_model', 'Erstelle einen Trainingsplan', { app: 'bettergym' }],
        ['vision_model', 'Was ist das?', { hasImage: true }],
      ];
      const expected = {
        cheap_model: [600, 300],
        chat_model: [1500, 600],
        reasoning_model: [3000, 900],
        vision_model: [1200, 600],
      };
      for (const [tier, text, extra] of cases) {
        const app = extra.app ?? 'getbetter';
        const written = route(app, text, { ...extra, voice: false });
        const spoken = route(app, text, { ...extra, voice: true });
        assert.equal(written.tier, tier);
        assert.deepEqual([written.maxChars, spoken.maxChars], expected[tier], tier);
        assert.equal(written.tts, false);
        assert.equal(spoken.tts, true);
      }
      assert.deepEqual(Object.keys(MAX_CHARS.voice).sort(), [...TIERS].sort());
    });

    test('tts nur bei voice === true', () => {
      assert.equal(route('getbetter', 'Hallo', { voice: 'true' }).tts, false);
      assert.equal(route('getbetter', 'Hallo').maxChars, 600);
    });

    test('costLevel folgt der Stufe', () => {
      assert.deepEqual(COST_LEVELS, {
        cheap_model: 'low',
        chat_model: 'medium',
        vision_model: 'medium',
        reasoning_model: 'high',
      });
      assert.equal(route('getbetter', 'Trag Milch ein').costLevel, 'low');
      assert.equal(route('betterai', 'Hallo').costLevel, 'medium');
      assert.equal(route('bettergym', 'Erstelle einen Trainingsplan').costLevel, 'high');
      assert.equal(route('getbetter', 'x', { hasImage: true }).costLevel, 'medium');
    });

    test('ohne Eingaben: ein Gespraech, nie ein Absturz', () => {
      assert.deepEqual(routeRequest(), {
        intent: 'conversation',
        tier: 'chat_model',
        maxChars: 1500,
        tts: false,
        costLevel: 'medium',
      });
    });
  });
});
