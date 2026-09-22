import { callService, type ServiceCall } from './service';

/**
 * Der Draht zur KI im Dienst (`/v1/ai/…`). Welches Modell antwortet, entscheidet
 * der Router dort — die günstigste Stufe, die die Frage kann. Der Schlüssel des
 * Anbieters verlässt den Dienst nie.
 */
export type AiTier = 'cheap_model' | 'chat_model' | 'reasoning_model' | 'vision_model';

export type AiApp = 'getbetter' | 'betterfamily' | 'bettergym' | 'betterai' | 'bettermoney';

export type AiTurn = { role: 'user' | 'assistant'; text: string };

/** Was der Assistent über die Daten weiss — eine Zeile je Eintrag, Ortszeit. */
export type AiContextItem = {
  /** Kennung wie `T1`: darüber trifft er bestehende Einträge. */
  ref?: string;
  kind: 'event' | 'task' | 'alarm' | 'birthday' | 'habit' | 'note' | 'shopping' | 'chore' | 'bill';
  title: string;
  /** `YYYY-MM-DD` */
  date?: string;
  /** `HH:MM` */
  time?: string;
  end?: string;
  note?: string;
};

export type AiContext = {
  /** Jetzt in Ortszeit, `YYYY-MM-DDTHH:MM`. */
  now: string;
  items: readonly AiContextItem[];
  facts?: readonly { label: string; value: string }[];
};

/** Ein Funktionsaufruf, geprüft vom Dienst — ausgeführt wird in der App. */
export type AiAction = { name: string; args: Record<string, unknown> };

export type AiRequest = {
  accountId: string;
  app: AiApp;
  /** Das Gespräch bis hierher; der letzte Zug ist die Frage. */
  messages: readonly AiTurn[];
  /** Im Gespräch per Stimme: kürzer, und dazu ein Text zum Vorlesen. */
  voice?: boolean;
  imageUploadId?: string;
  /** Die Funktionen der App anbieten (der Assistent, nie BetterAi). */
  tools?: boolean;
  /** Nur diese Funktionen anbieten — was zum Satz passt, spart Tokens. */
  toolNames?: readonly string[];
  context?: AiContext;
};

export type AiReply = {
  selected_model: AiTier;
  model: string;
  intent: string;
  response: string;
  /** Nur mit `voice`: ohne Zeichen, Listen und Links, zum Vorlesen. */
  voice_text?: string;
  /** Nur mit `tools`: was die App tun soll. Dann darf `response` leer sein. */
  actions?: readonly AiAction[];
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
