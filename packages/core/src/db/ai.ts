import { callService, type ServiceCall } from './service';

/**
 * Der Draht zur KI im Dienst (`/v1/ai/…`). Welches Modell antwortet, entscheidet
 * der Router dort — die günstigste Stufe, die die Frage kann. Der Schlüssel des
 * Anbieters verlässt den Dienst nie.
 */
export type AiTier = 'cheap_model' | 'chat_model' | 'reasoning_model' | 'vision_model';

export type AiApp = 'getbetter' | 'betterfamily' | 'bettergym' | 'betterai' | 'bettermoney';

export type AiTurn = { role: 'user' | 'assistant'; text: string };

export type AiRequest = {
  accountId: string;
  app: AiApp;
  /** Das Gespräch bis hierher; der letzte Zug ist die Frage. */
  messages: readonly AiTurn[];
  /** Im Gespräch per Stimme: kürzer, und dazu ein Text zum Vorlesen. */
  voice?: boolean;
  imageUploadId?: string;
};

export type AiReply = {
  selected_model: AiTier;
  model: string;
  intent: string;
  response: string;
  /** Nur mit `voice`: ohne Zeichen, Listen und Links, zum Vorlesen. */
  voice_text?: string;
  estimated_cost_level: 'low' | 'medium' | 'high';
};

export type AiStatus = {
  provider: string;
  configured: boolean;
  models: Record<AiTier, string>;
  lastError: string | null;
};

/**
 * Das Kontingent dieses Kontos in dieser App, diesen Monat (in Zürich). Ohne
 * Abo gilt ein kleines Gratis-Kontingent. `402 budget_exhausted` und
 * `403 plan_required` von `reply` tragen `plan`, `resetsOn` und `priceChf` mit.
 */
export type AiBudget = {
  plan: 'paid' | 'trial';
  budgetChf: number;
  spentChf: number;
  /** 0 bis 1: wie viel noch übrig ist. */
  remainingShare: number;
  /** `YYYY-MM-DD`: dann ist es wieder voll. */
  resetsOn: string;
  /** Das Abo dieser App im Monat, oder null, solange es keines gibt. */
  priceChf: number | null;
};

export const ai = {
  status: (): Promise<ServiceCall<AiStatus>> => callService<AiStatus>('/v1/ai/status'),
  reply: (request: AiRequest): Promise<ServiceCall<AiReply>> =>
    callService<AiReply>('/v1/ai/reply', { method: 'POST', body: request }),
  budget: (accountId: string, app: AiApp): Promise<ServiceCall<AiBudget>> =>
    callService<AiBudget>(
      `/v1/ai/budget?${new URLSearchParams({ accountId, app }).toString()}`,
    ),
};
