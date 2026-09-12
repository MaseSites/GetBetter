import { currentApp } from '@/app/identity';

import { notifyDataChanged } from './live';
import { callService, type ServiceCall } from './service';
import { db, flush, refresh } from './store';
import type { NotificationKind, NotificationRow } from './types';

/**
 * Mitteilungen fuer die Glocke und fuer „Was gibt's Neues“.
 *
 * Die Sammlung gehoert dem Dienst: gelesen wird aus der Abschrift im Speicher,
 * geschrieben nur ueber `/v1/notifications` — nie ueber `db.notifications`,
 * sonst schriebe der Speicher sie zurueck, und der Dienst lehnt das ab.
 *
 * Nichts hier wirft. Jede Aenderung meldet `{ ok: true }` oder den Schluessel
 * des Dienstes (`not_found`, `unknown_route`, `offline` …).
 */

/** Was eine neue Mitteilung braucht. Ohne `app` gilt die laufende App. */
export type NewNotification = {
  /** Wer sie bekommt. */
  accountId: string;
  kind: NotificationKind;
  /** Daten, keine Saetze: Name der Person, Absender … */
  title: string;
  /** Kalendername, Haushaltsname, Betreff … */
  body: string;
  ref: Readonly<Record<string, string>>;
  app?: string;
};

export type NotificationResult = { ok: true } | { ok: false; error: string };

/** Alle Mitteilungen einer Art, deren `ref[key]` passt — auf Wunsch nur fuer ein Konto. */
export type NotificationRefMatch = {
  accountId?: string;
  kind: NotificationKind;
  key: string;
  value: string;
};

/** Geloescht ist geloescht — auch wenn es schon jemand anders war. */
const GONE = 'not_found';

function newestFirst(a: NotificationRow, b: NotificationRow): number {
  return b.createdAt.localeCompare(a.createdAt);
}

function path(...parts: string[]): string {
  return `/v1/${parts.map((part) => encodeURIComponent(part)).join('/')}`;
}

/**
 * Erst das Eigene wegschreiben, dann den Dienst fragen. Sonst traegt die
 * Fassungsnummer eines spaeteren Zurueckschreibens die Aenderung des Dienstes
 * schon mit — und der Speicher merkt nie, dass er neu laden muss.
 */
async function send(
  target: string,
  init?: { method: 'POST' | 'DELETE'; body?: unknown },
): Promise<ServiceCall<unknown>> {
  try {
    await flush();
    return await callService<unknown>(target, init);
  } catch {
    return { ok: false, error: 'offline' };
  }
}

/** Nach einer Aenderung beim Dienst: neu laden und die Bildschirme wecken. */
async function settle(results: readonly ServiceCall<unknown>[]): Promise<NotificationResult> {
  const failure = results.find((result) => !result.ok && result.error !== GONE);
  if (results.some((result) => result.ok || result.error === GONE)) {
    try {
      await refresh();
    } catch {
      // Der naechste Abgleich holt es nach.
    }
    notifyDataChanged();
  }
  return failure && !failure.ok ? { ok: false, error: failure.error } : { ok: true };
}

export const notifications = {
  /** Alle Mitteilungen eines Kontos, die neueste zuerst. */
  async list(accountId: string): Promise<NotificationRow[]> {
    return db.notifications.list({
      where: (row) => row.accountId === accountId,
      sort: newestFirst,
    });
  },

  /** Was noch nicht als gelesen markiert ist, die neueste zuerst. */
  async unread(accountId: string): Promise<NotificationRow[]> {
    return db.notifications.list({
      where: (row) => row.accountId === accountId && !row.readAt,
      sort: newestFirst,
    });
  },

  async create(input: NewNotification): Promise<NotificationResult> {
    const result = await send(path('notifications'), {
      method: 'POST',
      body: {
        accountId: input.accountId,
        kind: input.kind,
        title: input.title,
        body: input.body,
        ref: input.ref,
        app: input.app ?? currentApp().id,
      },
    });
    return settle([result]);
  },

  /**
   * Fuer die Stellen, an denen eine Anfrage entsteht. Was beim Zusammenstellen
   * oder Anlegen schiefgeht, bleibt hier: die Einladung selbst steht schon, und
   * die Person sieht sie auch ohne Mitteilung an ihrer Stelle.
   */
  async announce(build: () => Promise<NewNotification | null>): Promise<void> {
    try {
      const input = await build();
      if (input) await notifications.create(input);
    } catch {
      // Bewusst still — siehe oben.
    }
  },

  async markRead(id: string): Promise<NotificationResult> {
    return settle([await send(path('notifications', id, 'read'), { method: 'POST' })]);
  },

  async remove(id: string): Promise<NotificationResult> {
    return settle([await send(path('notifications', id), { method: 'DELETE' })]);
  },

  /** Die Glocke leeren. Die E-Mails und Anfragen dahinter bleiben, wo sie sind. */
  async removeAll(accountId: string): Promise<NotificationResult> {
    const rows = await notifications.list(accountId).catch(() => []);
    if (rows.length === 0) return { ok: true };
    try {
      await flush();
    } catch {
      // Dann eben mit dem, was schon beim Dienst liegt.
    }
    const results = await Promise.all(
      rows.map((row) => callService<unknown>(path('notifications', row.id), { method: 'DELETE' })),
    );
    return settle(results);
  },

  /** Beim Beantworten oder Zuruecknehmen einer Anfrage: ihre Mitteilungen weg. */
  async removeByRef(match: NotificationRefMatch): Promise<NotificationResult> {
    const result = await send(path('notifications', 'remove-by-ref'), {
      method: 'POST',
      body: {
        ...(match.accountId ? { accountId: match.accountId } : {}),
        kind: match.kind,
        key: match.key,
        value: match.value,
      },
    });
    return settle([result]);
  },

  /** Die E-Mail auf dem Server als gelesen markieren; der Dienst setzt die Mitteilung mit. */
  async mailSeen(mailMessageId: string): Promise<NotificationResult> {
    const result = await send(path('mail', 'messages', mailMessageId, 'seen'), {
      method: 'POST',
      body: { seen: true },
    });
    return settle([result]);
  },

  /** In den Papierkorb des Postfachs; der Dienst entfernt Zeile und Mitteilungen. */
  async mailDelete(mailMessageId: string): Promise<NotificationResult> {
    const result = await send(path('mail', 'messages', mailMessageId, 'delete'), {
      method: 'POST',
    });
    return settle([result]);
  },
};
