/**
 * Ein schlichtes Fenster je Schluessel (Konto oder IP): hoechstens `perMinute`
 * Anfragen in den letzten 60 Sekunden. Lebt nur im Speicher.
 */
function createRateLimiter({ perMinute, now = () => Date.now() }) {
  const hits = new Map();

  function allow(key) {
    const cutoff = now() - 60_000;
    const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);
    if (recent.length >= perMinute) {
      hits.set(key, recent);
      return false;
    }
    recent.push(now());
    hits.set(key, recent);
    // Alte Schluessel aufraeumen, damit die Tabelle nicht waechst.
    if (hits.size > 10_000) {
      for (const [other, list] of hits) if (list.every((at) => at <= cutoff)) hits.delete(other);
    }
    return true;
  }

  return { allow };
}

module.exports = { createRateLimiter };
