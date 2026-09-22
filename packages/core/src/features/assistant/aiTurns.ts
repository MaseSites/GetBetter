import type { AiTurn } from '../../db/ai';
import type { Language, Translate, TranslationKey } from '../../i18n';
import { formatDayMonth, formatPrice } from '../../i18n/format';

/** So viele Züge gehen mit — genug für den Zusammenhang, wenig für die Kosten. */
export const AI_HISTORY_LIMIT = 12;
/** Der Assistent erledigt Dinge; dafür reichen die letzten Züge. */
export const ASSISTANT_HISTORY_LIMIT = 6;
/** So lang darf ein Zug sein; der Dienst nimmt nicht mehr. */
export const AI_TURN_MAX_CHARS = 4000;

/**
 * Das Gespräch für den Dienst: die letzten Züge und dazu die neue Frage, die
 * immer als letzter Zug steht. Leeres fällt weg, Überlanges wird gekürzt.
 */
export function turnsFor(
  history: readonly { role: string; text: string }[],
  question: string,
): AiTurn[] {
  const past = history.flatMap((message): AiTurn[] =>
    (message.role === 'user' || message.role === 'assistant') && message.text.trim().length > 0
      ? [{ role: message.role, text: message.text.slice(0, AI_TURN_MAX_CHARS) }]
      : [],
  );
  const asked: AiTurn = { role: 'user', text: question.slice(0, AI_TURN_MAX_CHARS) };
  return [...past, asked].slice(-AI_HISTORY_LIMIT);
}

/** Warum keine Antwort kam — beim Kontingent mit Plan, Datum und Preis der App. */
export type AiFailure = {
  error: string;
  plan: 'paid' | 'trial' | null;
  /** `YYYY-MM-DD`: dann ist das Kontingent wieder voll. */
  resetsOn: string | null;
  /** Das Abo dieser App im Monat, oder null ohne Abo. */
  priceChf: number | null;
};

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Aus der Antwort von `callService` (`error` und der Rest der Antwort in `details`). */
export function aiFailureOf(result: { error: string; details?: unknown }): AiFailure {
  const details = typeof result.details === 'object' && result.details !== null ? result.details : {};
  const { plan, resetsOn, priceChf } = details as Record<string, unknown>;
  return {
    error: result.error,
    plan: plan === 'paid' || plan === 'trial' ? plan : null,
    resetsOn: typeof resetsOn === 'string' && DAY_PATTERN.test(resetsOn) ? resetsOn : null,
    priceChf: typeof priceChf === 'number' && Number.isFinite(priceChf) && priceChf > 0 ? priceChf : null,
  };
}

/**
 * Was er sagt, wenn keine Antwort kommt. Ist noch keine KI eingerichtet, bleibt
 * es beim ehrlichen Satz von vorher.
 */
export function aiFailureKey(failure: string | AiFailure): TranslationKey {
  const { error, plan, priceChf } =
    typeof failure === 'string' ? { error: failure, plan: null, priceChf: null } : failure;
  if (error === 'not_configured' || error === 'unknown_route' || error === 'http_404') {
    return 'assistant.reply';
  }
  if (error === 'budget_exhausted') {
    if (plan === 'paid') return 'assistant.ai.budgetExhausted';
    return priceChf === null ? 'assistant.ai.trialExhaustedSoon' : 'assistant.ai.trialExhausted';
  }
  if (error === 'plan_required') return 'assistant.ai.planRequired';
  if (error === 'read_only') return 'view.readOnly';
  if (error === 'offline') return 'assistant.ai.offline';
  if (error === 'rate_limited') return 'assistant.ai.busy';
  return 'assistant.ai.failed';
}

/**
 * Ob unter der Antwort „Abo ansehen“ steht: wenn etwas nur mit dem Abo geht,
 * oder das Gratis-Kontingent einer App aufgebraucht ist, die ein Abo hat.
 */
export function aiFailureOffersPlan(failure: AiFailure): boolean {
  if (failure.error === 'plan_required') return true;
  return failure.error === 'budget_exhausted' && failure.plan !== 'paid' && failure.priceChf !== null;
}

/** Der Tag, an dem es weitergeht — sonst der Erste des naechsten Monats. */
function resetDateOf(resetsOn: string | null, now: Date): Date {
  const match = resetsOn ? DAY_PATTERN.exec(resetsOn) : null;
  if (match) return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/** Der ganze Satz, mit Datum und Preis in der Sprache des Kontos. */
export function aiFailureText(
  t: Translate,
  language: Language,
  failure: AiFailure,
  now: Date = new Date(),
): string {
  return t(aiFailureKey(failure), {
    date: formatDayMonth(language, resetDateOf(failure.resetsOn, now)),
    price: failure.priceChf === null ? '' : formatPrice(language, failure.priceChf),
  });
}
