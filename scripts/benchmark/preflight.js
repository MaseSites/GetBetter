/**
 * Vorabfrage ans Modell, bevor ein langer Lauf beginnt.
 *
 * Der Gratis-Zugang von Gemini erlaubt **20 Anfragen je Modell und Tag**
 * (`GenerateRequestsPerDayPerProjectPerModel-FreeTier`). Ist das aufgebraucht,
 * antwortet jede Anfrage mit 429 — der Dienst meldet nur `provider_busy`, und
 * ein Benchmark ueber 40 Gerichte liefe eine halbe Stunde ins Leere.
 *
 * Darum hier ein winziger Textaufruf (kein Bild, kaum Tokens): geht er durch,
 * ist Kontingent da; kommt 429, steht in der Meldung, warum — Tageskontingent
 * oder nur gerade zu viel auf einmal.
 *
 * Der Schluessel bleibt in dieser Datei und steht in keiner Rueckgabe.
 */

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/**
 * `{ ok, status, daily, limit, retryAfterS, message }`.
 * `daily: true` heisst: heute geht mit diesem Modell nichts mehr.
 */
async function preflight(model, apiKey, { baseUrl = API_BASE, fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'ok' }] }],
        generationConfig: { maxOutputTokens: 400 },
      }),
    });
  } catch (error) {
    return { ok: false, status: 0, daily: false, message: `nicht erreichbar: ${error.message}` };
  }
  if (response.status === 200) return { ok: true, status: 200, daily: false, message: 'Kontingent da' };

  const text = await response.text().catch(() => '');
  if (response.status === 401 || response.status === 403)
    return { ok: false, status: response.status, daily: false, message: 'Schlüssel abgelehnt' };
  if (response.status === 404)
    return { ok: false, status: 404, daily: false, message: `Modell ${model} gibt es für diesen Schlüssel nicht` };

  const quotaId = /"quotaId":\s*"([^"]+)"/.exec(text)?.[1] ?? '';
  const limit = /limit:\s*(\d+)/.exec(text)?.[1] ?? null;
  const retryAfterS = Number(/retry in ([\d.]+)s/.exec(text)?.[1] ?? 0) || null;
  const daily = response.status === 429 && /PerDay/i.test(quotaId);
  const message =
    response.status === 429
      ? daily
        ? `Tageskontingent aufgebraucht (${limit ?? '?'} Anfragen je Tag für ${model}, Gratis-Zugang). Es füllt sich um Mitternacht Pacific Time wieder.`
        : `gerade zu viel auf einmal (429${retryAfterS ? `, erneut in ~${retryAfterS} s` : ''})`
      : `HTTP ${response.status}`;
  return { ok: false, status: response.status, daily, limit: limit ? Number(limit) : null, retryAfterS, quotaId, message };
}

module.exports = { preflight, API_BASE };
