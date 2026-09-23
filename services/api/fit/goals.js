/**
 * Persoenliche Kalorien- und Makroziele — reine Rechnung, getestet.
 *
 * Grundumsatz nach Mifflin-St Jeor, mal Aktivitaet, plus oder minus das Ziel.
 * Das sind Startschaetzungen, keine medizinischen Werte; die App sagt das.
 * Fuer Minderjaehrige, Schwangerschaft, Stillzeit, Essstoerungen oder eine
 * Erkrankung rechnet sie nie ein Defizit oder einen Ueberschuss, sondern
 * bleibt beim Erhalt und empfiehlt eine Fachperson.
 */

const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** kg je Woche. Bewusst vorsichtig: schneller geht es nicht. */
const PACE_KG_PER_WEEK = {
  lose: { gentle: 0.25, moderate: 0.5 },
  gain: { gentle: 0.125, moderate: 0.25 },
};
const KCAL_PER_KG = 7700;

/** Nie darunter, auch nicht beim Abnehmen. */
const MIN_KCAL = 1200;
/** Trainingstage bekommen etwas mehr, Ruhetage entsprechend weniger — die Woche bleibt gleich. */
const TRAINING_DAY_BONUS = 0.1;

const SEXES = ['female', 'male', 'unspecified'];
const GOALS = ['lose', 'maintain', 'gain'];
const PACES = ['gentle', 'moderate'];
const DIETS = ['omnivore', 'vegetarian', 'vegan', 'pescetarian'];

/** Die 14 Hauptallergene der Schweiz und der EU. */
const ALLERGENS = [
  'gluten',
  'crustaceans',
  'egg',
  'fish',
  'peanut',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
];

function ageOn(birthDate, today) {
  const birth = new Date(`${birthDate}T12:00:00Z`);
  const now = new Date(`${today}T12:00:00Z`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(now.getTime())) return null;
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const before =
    now.getUTCMonth() < birth.getUTCMonth() ||
    (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate());
  if (before) age -= 1;
  return age;
}

function bmrOf({ weightKg, heightCm, age, sex }) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  if (sex === 'male') return base + 5;
  if (sex === 'female') return base - 161;
  // Ohne Angabe die Mitte der beiden Formeln.
  return base - 78;
}

const round10 = (value) => Math.round(value / 10) * 10;

/**
 * Unter diesem BMI rechnet die App kein Ziel mehr, sondern nur den Erhalt.
 * 17.5 ist die Grenze, ab der die WHO von massiger bis starker Untergewichtigkeit
 * spricht. Wer dort steht, braucht keine Zielvorgabe aus einer App, sondern eine
 * Fachperson — und erst recht kein Defizit.
 */
const MIN_SAFE_BMI = 17.5;

/** Der BMI, wenn Gewicht und Groesse plausibel sind — sonst null. */
function bmiOf(weightKg, heightCm) {
  if (!(weightKg > 0) || !(heightCm > 0)) return null;
  const metres = heightCm / 100;
  return weightKg / (metres * metres);
}

/** Warum nur Erhalt gerechnet wird — oder eine leere Liste. */
function safetyReasons(profile, age) {
  const reasons = [];
  if (age !== null && age < 18) reasons.push('minor');
  // Gerechnet wird mit dem Gewicht, das wirklich gilt (das neueste aus dem
  // Tagebuch, siehe `currentWeightKg`) — nicht mit dem, was einmal im Profil
  // stand. Sonst haette ein alter Profilwert die Pruefung ausgehebelt.
  const bmi = bmiOf(profile.weightKg, profile.heightCm);
  if (bmi !== null && bmi < MIN_SAFE_BMI) reasons.push('very_low_weight');
  if (profile.pregnant === true) reasons.push('pregnancy');
  if (profile.breastfeeding === true) reasons.push('breastfeeding');
  if (profile.eatingDisorder === true) reasons.push('eating_disorder');
  if (profile.medicalCondition === true) reasons.push('medical_condition');
  return reasons;
}

/** Protein, Fett und Kohlenhydrate zu einer Kalorienzahl. */
function macrosFor(kcal, weightKg, goal, conservative) {
  const perKg = conservative ? 1.2 : goal === 'lose' ? 1.8 : goal === 'gain' ? 1.6 : 1.4;
  const proteinG = Math.round(Math.min(perKg * weightKg, 2.2 * weightKg, (kcal * 0.35) / 4));
  const fatG = Math.round(Math.max((kcal * 0.28) / 9, 0.6 * weightKg));
  const carbsG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  return { kcal, proteinG, carbsG, fatG };
}

/**
 * Prueft ein Profil. Gibt `{ ok: true, profile }` mit bereinigten Werten oder
 * `{ ok: false, errors }` mit den Feldnamen zurueck.
 */
function validateProfile(input, today) {
  const errors = [];
  const number = (value, min, max, field) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < min || n > max) {
      errors.push(field);
      return null;
    }
    return n;
  };
  const pick = (value, allowed, field, fallback) => {
    if (value === undefined || value === null) return fallback;
    if (!allowed.includes(value)) {
      errors.push(field);
      return fallback;
    }
    return value;
  };
  const list = (value, allowed, field) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.some((entry) => !allowed.includes(entry))) {
      errors.push(field);
      return [];
    }
    return [...new Set(value)];
  };
  const words = (value, field) => {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > 30) {
      errors.push(field);
      return [];
    }
    return [
      ...new Set(
        value
          .filter((entry) => typeof entry === 'string')
          .map((entry) => entry.trim().toLowerCase().slice(0, 40))
          .filter((entry) => entry.length > 0),
      ),
    ];
  };

  const birthDate = typeof input.birthDate === 'string' ? input.birthDate : '';
  const age = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? ageOn(birthDate, today) : null;
  if (age === null || age < 13 || age > 110) errors.push('birthDate');

  const profile = {
    birthDate,
    heightCm: number(input.heightCm, 120, 230, 'heightCm'),
    weightKg: number(input.weightKg, 30, 350, 'weightKg'),
    sex: pick(input.sex, SEXES, 'sex', 'unspecified'),
    activity: pick(input.activity, Object.keys(ACTIVITY_FACTORS), 'activity', 'light'),
    trainingDaysPerWeek: number(input.trainingDaysPerWeek ?? 3, 0, 7, 'trainingDaysPerWeek'),
    goal: pick(input.goal, GOALS, 'goal', 'maintain'),
    pace: pick(input.pace, PACES, 'pace', 'gentle'),
    diet: pick(input.diet, DIETS, 'diet', 'omnivore'),
    allergies: list(input.allergies, ALLERGENS, 'allergies'),
    excludedFoods: words(input.excludedFoods, 'excludedFoods'),
    pregnant: input.pregnant === true,
    breastfeeding: input.breastfeeding === true,
    eatingDisorder: input.eatingDisorder === true,
    medicalCondition: input.medicalCondition === true,
    householdSize: number(input.householdSize ?? 1, 1, 12, 'householdSize'),
    budget: pick(input.budget, ['low', 'medium', 'high'], 'budget', 'medium'),
    maxCookMinutes: number(input.maxCookMinutes ?? 45, 5, 240, 'maxCookMinutes'),
    equipment: words(input.equipment ?? ['stove', 'oven'], 'equipment'),
    timezone: typeof input.timezone === 'string' && input.timezone.length < 64 ? input.timezone : 'Europe/Zurich',
    units: 'metric',
  };
  if (profile.trainingDaysPerWeek !== null) profile.trainingDaysPerWeek = Math.round(profile.trainingDaysPerWeek);
  if (profile.householdSize !== null) profile.householdSize = Math.round(profile.householdSize);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, profile };
}

/**
 * Die Ziele zu einem gueltigen Profil. `today` als `YYYY-MM-DD`.
 * `kcalAdjustment` ist eine vom Nutzer bestaetigte Korrektur aus dem Gewichtstrend.
 */
function computeGoals(profile, today, kcalAdjustment = 0) {
  const age = ageOn(profile.birthDate, today) ?? 30;
  const bmr = bmrOf({ weightKg: profile.weightKg, heightCm: profile.heightCm, age, sex: profile.sex });
  const tdee = bmr * (ACTIVITY_FACTORS[profile.activity] ?? ACTIVITY_FACTORS.light);
  const reasons = safetyReasons(profile, age);
  const conservative = reasons.length > 0;
  const goal = conservative ? 'maintain' : profile.goal;

  let delta = 0;
  if (goal === 'lose') delta = -(PACE_KG_PER_WEEK.lose[profile.pace] * KCAL_PER_KG) / 7;
  if (goal === 'gain') delta = (PACE_KG_PER_WEEK.gain[profile.pace] * KCAL_PER_KG) / 7;
  const adjustment = conservative ? 0 : Math.max(-300, Math.min(300, Number(kcalAdjustment) || 0));
  const floor = Math.max(MIN_KCAL, Math.round(bmr));
  const target = round10(Math.max(floor, tdee + delta + adjustment));

  const days = Math.max(0, Math.min(7, profile.trainingDaysPerWeek ?? 0));
  let trainingKcal = target;
  let restKcal = target;
  if (days > 0 && days < 7) {
    trainingKcal = round10(target * (1 + TRAINING_DAY_BONUS));
    restKcal = round10(Math.max(floor, (7 * target - days * trainingKcal) / (7 - days)));
  }

  return {
    ...macrosFor(target, profile.weightKg, goal, conservative),
    trainingDay: macrosFor(trainingKcal, profile.weightKg, goal, conservative),
    restDay: macrosFor(restKcal, profile.weightKg, goal, conservative),
    bmr: Math.round(bmr),
    tdee: Math.round(tdee),
    goal,
    safety: { mode: conservative ? 'maintain_only' : 'normal', reasons },
    adjustment,
    isEstimate: true,
  };
}

/**
 * Gleitender Gewichtstrend (exponentiell, 10 % je Eintrag), nach Tag sortiert.
 * Gibt je Tag den Trendwert zurueck — ein einzelner Ausreisser bewegt ihn kaum.
 */
function weightTrend(entries) {
  const sorted = [...entries]
    .filter((entry) => Number.isFinite(entry.weightKg))
    .sort((a, b) => a.day.localeCompare(b.day));
  let trend = null;
  return sorted.map((entry) => {
    trend = trend === null ? entry.weightKg : trend + 0.1 * (entry.weightKg - trend);
    return { day: entry.day, weightKg: entry.weightKg, trendKg: Math.round(trend * 100) / 100 };
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;
const dayNumber = (day) => Date.parse(`${day}T12:00:00Z`) / DAY_MS;

/**
 * Nach zwei bis drei Wochen: laeuft der Trend anders als geplant, schlaegt die
 * App eine vorsichtige Korrektur vor (hoechstens 100 kcal). Uebernommen wird
 * sie erst nach Bestaetigung. Ohne genug Daten: null.
 */
function suggestAdjustment(profile, entries, today) {
  if (safetyReasons(profile, ageOn(profile.birthDate, today)).length > 0) return null;
  const trend = weightTrend(entries).filter((entry) => dayNumber(today) - dayNumber(entry.day) <= 21);
  if (trend.length < 6) return null;
  const first = trend[0];
  const last = trend[trend.length - 1];
  const span = dayNumber(last.day) - dayNumber(first.day);
  if (span < 14) return null;

  const actualPerWeek = ((last.trendKg - first.trendKg) / span) * 7;
  const plannedPerWeek =
    profile.goal === 'lose'
      ? -PACE_KG_PER_WEEK.lose[profile.pace]
      : profile.goal === 'gain'
        ? PACE_KG_PER_WEEK.gain[profile.pace]
        : 0;
  const gap = actualPerWeek - plannedPerWeek;
  // Unter 0.15 kg je Woche ist Rauschen.
  if (Math.abs(gap) < 0.15) return null;
  const kcal = -Math.sign(gap) * Math.min(100, round10((Math.abs(gap) * KCAL_PER_KG) / 7));
  return {
    kcal,
    actualKgPerWeek: Math.round(actualPerWeek * 100) / 100,
    plannedKgPerWeek: plannedPerWeek,
    days: span,
  };
}

/**
 * Das Gewicht, mit dem gerechnet wird: der neueste Eintrag, wenn er nicht aelter
 * ist als die letzte Aenderung des Profils — sonst das Gewicht im Profil.
 */
function currentWeightKg(profileRow, weightEntries = []) {
  const profileKg = profileRow?.profile?.weightKg ?? null;
  const latest = [...weightEntries]
    .filter((entry) => Number.isFinite(entry?.weightKg) && typeof entry.day === 'string')
    .sort((a, b) => b.day.localeCompare(a.day))[0];
  if (!latest) return profileKg;
  const profileDay = String(profileRow?.updatedAt ?? profileRow?.createdAt ?? '').slice(0, 10);
  return !profileDay || latest.day >= profileDay || profileKg === null ? latest.weightKg : profileKg;
}

module.exports = {
  ACTIVITY_FACTORS,
  ALLERGENS,
  DIETS,
  GOALS,
  KCAL_PER_KG,
  MIN_KCAL,
  MIN_SAFE_BMI,
  PACE_KG_PER_WEEK,
  ageOn,
  bmiOf,
  bmrOf,
  computeGoals,
  currentWeightKg,
  safetyReasons,
  suggestAdjustment,
  validateProfile,
  weightTrend,
};
