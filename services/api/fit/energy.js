/**
 * Was du **wirklich** verbrauchst — gerechnet aus deinen eigenen Zahlen statt
 * aus einer Formel.
 *
 * `goals.js` schaetzt den Verbrauch mit Mifflin-St Jeor mal einem
 * Aktivitaetsfaktor. Das ist ein brauchbarer Startwert, aber der Faktor ist
 * geraten, und wer sich verschaetzt, rechnet Monate mit einem Ziel, das um
 * mehrere hundert Kalorien danebenliegt.
 *
 * Dieses Modul braucht keine Schaetzung. Es nutzt den Energieerhaltungssatz:
 *
 *     Verbrauch = durchschnittliche Zufuhr − Gewichtsaenderung × 7700 kcal/kg
 *
 * Wer 2100 kcal isst und dabei 0.4 kg je Woche verliert, verbraucht rund
 * 2540 kcal — egal, was eine Formel sagt. Nach zwei bis vier Wochen mit
 * gefuehrtem Tagebuch steht die Zahl, und sie wird mit jedem Tag genauer.
 *
 * Grenzen, die das Modul selbst kennt und meldet:
 * - **Rauschen.** Ein einzelner Tag sagt nichts (Wasser, Salz, Verdauung).
 *   Gerechnet wird darum auf dem geglaetteten Trend aus `weightTrend`.
 * - **Luecken.** Wer nur die Haelfte der Tage eintraegt, hat keine
 *   Durchschnittszufuhr, sondern eine Auswahl — meist die braven Tage. Unter
 *   `MIN_COVERAGE` gibt es darum keine Zahl.
 * - **Zu wenig Zeit.** Unter `MIN_DAYS` ist der Trend noch Rauschen.
 * - **Sicherheit.** Fuer wen `goals.js` kein Defizit rechnet (minderjaehrig,
 *   schwanger, stillend, Essstoerung, Erkrankung), rechnet auch dieses Modul
 *   kein Ziel. Die Zahl zum Verbrauch darf es trotzdem geben — sie ist eine
 *   Beobachtung, keine Vorgabe.
 *
 * Alles hier ist reine Rechnung ohne Speicher und ohne Netz, darum getestet.
 */
const { KCAL_PER_KG, MIN_KCAL, PACE_KG_PER_WEEK, ageOn, safetyReasons, weightTrend } = require('./goals.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (day) => Date.parse(`${day}T12:00:00Z`) / DAY_MS;

/** So weit zurueck wird geschaut. Laenger waere traeger als das echte Leben. */
const WINDOW_DAYS = 28;
/** Darunter ist der Gewichtstrend noch Rauschen. */
const MIN_DAYS = 14;
/** So viele Tage im Fenster muessen ein Tagebuch haben. */
const MIN_COVERAGE = 0.6;
/** Ein Tag unter so vielen kcal war kein Tagebuch, sondern ein vergessener Tag. */
const MIN_DAY_KCAL = 800;
/** So weit darf sich ein Ziel auf einmal bewegen — der Rest kommt naechste Woche. */
const MAX_STEP_KCAL = 300;
/**
 * Mehr Gewichtsaenderung als das je Woche ist ueber Wochen hinweg kein Fett und
 * kein Muskel, sondern Wasser oder ein Tippfehler auf der Waage. In der ersten
 * Woche einer Umstellung kommt es vor; im Schnitt ueber vier Wochen nicht.
 */
const MAX_KG_PER_WEEK = 1.5;

const round10 = (value) => Math.round(value / 10) * 10;

/**
 * Wie gut die Schaetzung ist. Mehr Tage und weniger Luecken heisst sicherer;
 * die Stufen stehen hier, damit die App sie benennen kann statt eine nackte
 * Zahl zu zeigen.
 */
function confidenceOf(days, coverage) {
  if (days >= 21 && coverage >= 0.85) return 'high';
  if (days >= 18 && coverage >= 0.7) return 'medium';
  return 'low';
}

/**
 * Der geschaetzte Verbrauch aus Tagebuch und Waage.
 *
 * `weightEntries`: [{ day, weightKg }] · `intakeByDay`: { '2026-09-22': 2100 }
 * `today`: 'YYYY-MM-DD'.
 *
 * Gibt `{ kcal, confidence, days, loggedDays, coverage, meanIntakeKcal,
 * weightChangeKgPerWeek, from, to }` oder `null`, wenn die Daten nicht
 * reichen. Nie ein Fehler: fehlende Daten sind ein erwarteter Zustand.
 */
function estimateExpenditure(weightEntries, intakeByDay, today, options = {}) {
  const window = options.windowDays ?? WINDOW_DAYS;
  const minDays = options.minDays ?? MIN_DAYS;
  const minCoverage = options.minCoverage ?? MIN_COVERAGE;
  if (typeof today !== 'string' || Number.isNaN(dayNumber(today))) return null;

  const trend = weightTrend(Array.isArray(weightEntries) ? weightEntries : []).filter(
    (entry) => dayNumber(today) - dayNumber(entry.day) <= window,
  );
  if (trend.length < 2) return null;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const span = dayNumber(last.day) - dayNumber(first.day);
  if (span < minDays) return null;

  // Gezaehlt wird nur, was zwischen erstem und letztem Wiegen liegt — sonst
  // gehoerte die Zufuhr zu einer anderen Gewichtsaenderung.
  const logged = [];
  for (const [day, kcal] of Object.entries(intakeByDay ?? {})) {
    if (!Number.isFinite(kcal) || kcal < MIN_DAY_KCAL) continue;
    const number = dayNumber(day);
    if (Number.isNaN(number) || number < dayNumber(first.day) || number > dayNumber(last.day))
      continue;
    logged.push(kcal);
  }
  // Der Zeitraum hat `span` Uebergaenge, also `span + 1` Tage.
  const coverage = logged.length / (span + 1);
  if (logged.length === 0 || coverage < minCoverage) return null;

  const meanIntake = logged.reduce((total, kcal) => total + kcal, 0) / logged.length;
  const changePerDay = (last.trendKg - first.trendKg) / span;
  // Erst die Waage pruefen, dann rechnen: aus einer unmoeglichen Aenderung
  // folgt sonst eine Zahl, die plausibel aussieht und falsch ist.
  if (Math.abs(changePerDay * 7) > MAX_KG_PER_WEEK) return null;
  const kcal = meanIntake - changePerDay * KCAL_PER_KG;
  // Ein Mensch verbraucht weder 600 noch 8000 kcal am Tag. Kommt das heraus,
  // stimmen die Daten nicht (falsch getippte Waage, vergessene Tage).
  if (!Number.isFinite(kcal) || kcal < 1000 || kcal > 6000) return null;

  return {
    kcal: round10(kcal),
    confidence: confidenceOf(span, coverage),
    days: span,
    loggedDays: logged.length,
    coverage: Math.round(coverage * 100) / 100,
    meanIntakeKcal: Math.round(meanIntake),
    weightChangeKgPerWeek: Math.round(changePerDay * 7 * 100) / 100,
    from: first.day,
    to: last.day,
  };
}

/** Wie viele kcal je Tag das gewaehlte Tempo kostet oder bringt. */
function paceKcalOf(profile) {
  if (profile.goal === 'lose') return (-PACE_KG_PER_WEEK.lose[profile.pace] * KCAL_PER_KG) / 7;
  if (profile.goal === 'gain') return (PACE_KG_PER_WEEK.gain[profile.pace] * KCAL_PER_KG) / 7;
  return 0;
}

/**
 * Das Ziel, das aus dem gemessenen Verbrauch folgt — und wie weit es vom
 * bisherigen abweicht.
 *
 * `currentTargetKcal` ist das Ziel, mit dem gerade gerechnet wird (aus
 * `computeGoals`). Das neue Ziel bewegt sich hoechstens `MAX_STEP_KCAL` davon
 * weg: eine Schaetzung, die um 600 kcal danebenlag, wird in zwei Schritten
 * gerade gezogen, nicht in einem — sonst springt das Tagesziel, und Vertrauen
 * entsteht so nicht.
 *
 * Gibt `null`, wenn es nichts zu sagen gibt: keine Schaetzung, zu unsicher,
 * ein Sicherheitsgrund, oder die Abweichung ist kleiner als `minGapKcal`.
 */
function adaptiveTarget(estimate, profile, currentTargetKcal, today, options = {}) {
  const minGap = options.minGapKcal ?? 100;
  if (!estimate || estimate.confidence === 'low') return null;
  if (!profile || !Number.isFinite(currentTargetKcal)) return null;
  if (safetyReasons(profile, ageOn(profile.birthDate, today)).length > 0) return null;

  const wanted = Math.max(MIN_KCAL, round10(estimate.kcal + paceKcalOf(profile)));
  const gap = wanted - currentTargetKcal;
  if (Math.abs(gap) < minGap) return null;

  const step = Math.sign(gap) * Math.min(Math.abs(gap), MAX_STEP_KCAL);
  const target = Math.max(MIN_KCAL, round10(currentTargetKcal + step));
  if (target === currentTargetKcal) return null;
  return {
    kcal: target,
    fromKcal: currentTargetKcal,
    changeKcal: target - currentTargetKcal,
    // Wohin es am Ende laeuft, wenn sich nichts aendert — ehrlich, auch wenn
    // dieser Schritt nur die Haelfte davon geht.
    settlesAtKcal: wanted,
    expenditureKcal: estimate.kcal,
    confidence: estimate.confidence,
    days: estimate.days,
  };
}

module.exports = {
  MAX_KG_PER_WEEK,
  MAX_STEP_KCAL,
  MIN_COVERAGE,
  MIN_DAYS,
  MIN_DAY_KCAL,
  WINDOW_DAYS,
  adaptiveTarget,
  confidenceOf,
  estimateExpenditure,
  paceKcalOf,
};
