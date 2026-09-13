import { useEffect, useState } from 'react';

import { mail } from '@/db/mail';
import { useI18n } from '@/i18n';
import { useUndo } from '@/ui';

import {
  canSend,
  composeSignature,
  draftInputOf,
  emptyCompose,
  isDirty,
  sendInputOf,
  type ComposeState,
} from './compose';
import type { ComposeError } from './ComposeSheet';
import { DraftSaver } from './draftSaver';
import { mailErrorKey } from './format';

/** Solange man rückgängig machen kann, wartet die Mail im Dienst. */
export const SEND_DELAY_MS = 5000;
/** So oft sichert sich ein Entwurf selbst. */
export const AUTOSAVE_MS = 2000;

export type ComposeSession = {
  state: ComposeState;
  /** Womit verglichen wird, ob es etwas zu fragen gibt. */
  initial: ComposeState;
  /** `false`: minimiert, als Leiste unten. */
  open: boolean;
};

/** Der neueste Stand fuer den Takt, der alle 2 Sekunden sichert — ohne ihn neu zu starten. */
class LatestSession {
  private session: ComposeSession | null = null;

  set(session: ComposeSession | null) {
    this.session = session;
  }

  get(): ComposeSession | null {
    return this.session;
  }
}

/**
 * Das Schreib-Blatt ausserhalb des Blatts: so kostet Minimieren nichts, und
 * der Entwurf sichert sich weiter, auch als Leiste. Senden wartet 5 Sekunden
 * im Dienst — so lange hilft „Rückgängig“.
 */
export function useCompose(accountId: string) {
  const { t } = useI18n();
  const undo = useUndo();
  const [session, setSession] = useState<ComposeSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ComposeError | null>(null);
  const [saver] = useState(() => new DraftSaver((input) => mail.saveDraft(input)));
  const [latest] = useState(() => new LatestSession());

  useEffect(() => {
    latest.set(session);
  });

  const active = session !== null;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      const current = latest.get();
      if (!current) return;
      // Unveraendert und noch nie gesichert: es gibt keinen Entwurf.
      if (!isDirty(current.state, current.initial) && saver.id === current.state.draftId) return;
      const { state } = current;
      void saver.save(composeSignature(state), (draftId) =>
        draftInputOf(state, accountId, draftId),
      );
    }, AUTOSAVE_MS);
    return () => clearInterval(timer);
  }, [active, accountId, latest, saver]);

  /** Was im alten Blatt noch ungesichert steht, geht in den Entwurfsordner. */
  async function settleCurrent() {
    if (!session) return;
    const { state, initial } = session;
    if (isDirty(state, initial) || saver.id !== state.draftId) {
      await saver.save(composeSignature(state), (draftId) =>
        draftInputOf(state, accountId, draftId),
      );
    }
    await saver.finish();
  }

  async function start(state: ComposeState, initial: ComposeState = state) {
    await settleCurrent();
    saver.reset(state.draftId, state.mode === 'draft' ? composeSignature(state) : null);
    setError(null);
    setSession({ state, initial, open: true });
  }

  function change(patch: Partial<ComposeState>) {
    setError(null);
    setSession((current) =>
      current ? { ...current, state: { ...current.state, ...patch } } : current,
    );
  }

  function minimize() {
    setSession((current) => (current ? { ...current, open: false } : current));
  }

  function reopen() {
    setSession((current) => (current ? { ...current, open: true } : current));
  }

  /** Abbrechen ohne Aenderung. */
  function close() {
    void saver.finish();
    setSession(null);
  }

  async function saveAndClose() {
    if (!session) return;
    const { state } = session;
    const saved = await saver.save(composeSignature(state), (draftId) =>
      draftInputOf(state, accountId, draftId),
    );
    await saver.finish();
    setSession(null);
    undo.show({ message: saved ? t('mailui.toast.draftSaved') : t('mailui.toast.draftNotSaved') });
  }

  async function discard() {
    const draftId = await saver.finish();
    setSession(null);
    if (!draftId) return;
    const result = await mail.deleteDraft(draftId);
    undo.show({
      message: result.ok ? t('mailui.toast.draftDeleted') : t(mailErrorKey(result.error)),
    });
  }

  async function cancelSend(sendId: string, snapshot: ComposeState) {
    const result = await mail.cancelSend(sendId);
    if (!result.ok) {
      undo.show({ message: t(mailErrorKey(result.error)) });
      return;
    }
    if (result.data === 'already_sent') {
      undo.show({ message: t('mailui.toast.alreadySent') });
      return;
    }
    // Zurueck ins Blatt; Abbrechen fragt dann wieder, denn gesendet ist nichts.
    await start(snapshot, emptyCompose(snapshot.mailAccountId));
    undo.show({ message: t('mailui.toast.sendCancelled') });
  }

  async function send() {
    if (!session || busy) return;
    const { state } = session;
    if (!canSend(state)) {
      setError('recipients');
      return;
    }
    setBusy(true);
    setError(null);
    const draftId = await saver.finish();
    const input = sendInputOf(state, SEND_DELAY_MS, draftId);
    const result = input ? await mail.send(input) : null;
    setBusy(false);
    if (!result || !result.ok) {
      saver.resume();
      setError(result ? result.error : 'recipients');
      return;
    }
    setSession(null);
    const receipt = result.data;
    if (!receipt) {
      undo.show({ message: t('mailui.toast.sentNow') });
      return;
    }
    const snapshot: ComposeState = { ...state, draftId };
    undo.show({
      message: t('mailui.toast.sent'),
      durationMs: SEND_DELAY_MS,
      onUndo: () => void cancelSend(receipt.sendId, snapshot),
    });
  }

  return {
    session,
    busy,
    error,
    start,
    change,
    minimize,
    reopen,
    close,
    saveAndClose,
    discard,
    send,
  };
}
