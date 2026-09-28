/**
 * Ist Better Fit bereit fuer echte Menschen? Eine Liste der Luecken, leer
 * heisst ja. `server.js` meldet sie beim Start und startet in der Produktion
 * (`NODE_ENV=production`) gar nicht erst, solange eine davon offen ist — sonst
 * saehen zahlende Konten Beispielwerte statt der Schweizer Datenbank.
 *
 * `FIT_ALLOW_MOCK=1` laesst eine Vorfuehrung trotzdem starten.
 */

/**
 * `config`: `fitConfig()`. `catalog`: `catalog.info()` (`{ foods, swissVersion, mode }`).
 * Gibt Schluessel zurueck, keine Saetze — der Text steht in `PROBLEM_TEXT`.
 */
function fitProblems(config, catalog) {
  const problems = [];
  if (config.mode !== 'live') problems.push('mock_mode');
  if (config.mode === 'live' && !config.geminiKey) problems.push('gemini_key_missing');
  if (!catalog?.swissVersion) problems.push('swiss_catalog_missing');
  if (config.aiDisabled) problems.push('ai_disabled');
  return problems;
}

const PROBLEM_TEXT = {
  mock_mode: 'MEAL_ANALYSIS_MODE ist nicht "live" — Fotos und Etiketten liefern Beispielwerte',
  gemini_key_missing: 'GEMINI_API_KEY fehlt — Foto-Analyse antwortet mit not_configured',
  swiss_catalog_missing:
    'fit-catalog-swiss.json fehlt im Datenordner — Suche zeigt Beispielwerte (scripts/import-swiss-foods.js)',
  ai_disabled: 'FIT_AI_DISABLED=1 — die Foto-Analyse ist ausgeschaltet',
};

/** Muss der Dienst sich weigern zu starten? Nur in der Produktion, nie mit `FIT_ALLOW_MOCK=1`. */
function mustRefuse(problems, env = process.env) {
  if (env.NODE_ENV !== 'production' || env.FIT_ALLOW_MOCK === '1') return false;
  // Ausgeschaltet ist eine bewusste Entscheidung (Kill-Switch), kein Fehler.
  return problems.some((problem) => problem !== 'ai_disabled');
}

module.exports = { fitProblems, mustRefuse, PROBLEM_TEXT };
