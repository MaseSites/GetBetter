'use strict';

/**
 * Eine Bremse gegen Raten: hoechstens `limit` Versuche je Schluessel (Adresse,
 * E-Mail) in einem gleitenden Fenster von `windowMs`. Danach kommt `429` mit
 * `retryAfterMs`. Alles im Speicher — ein Neustart vergisst die Zaehler, und
 * das ist in Ordnung: die Bremse soll Passwort-Raten verlangsamen, nicht
 * Buch fuehren.
 */
function createLimiter({ limit, windowMs }) {
  const hits = new Map();

  function prune(now) {
    for (const [key, times] of hits) {
      const recent = times.filter((time) => now - time < windowMs);
      if (recent.length === 0) hits.delete(key);
      else hits.set(key, recent);
    }
  }

  return {
    /** Zaehlt einen Versuch — und sagt, ob er noch erlaubt war. */
    hit(key, now = Date.now()) {
      if (hits.size > 10_000) prune(now);
      const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        const oldest = recent[0] ?? now;
        return { allowed: false, retryAfterMs: Math.max(0, windowMs - (now - oldest)) };
      }
      hits.set(key, [...recent, now]);
      return { allowed: true, retryAfterMs: 0 };
    },
    /** Nach einem Erfolg darf man wieder von vorne anfangen. */
    reset(key) {
      hits.delete(key);
    },
  };
}

module.exports = { createLimiter };
