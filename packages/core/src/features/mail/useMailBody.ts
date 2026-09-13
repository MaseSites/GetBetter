import { useEffect, useState } from 'react';

import { mail, type MailBody, type MailError, type MailResult } from '@/db/mail';

export type MailBodyState = {
  /** Noch keine Antwort zu dieser Nachricht und dieser Bild-Einstellung. */
  loading: boolean;
  /** Der zuletzt geladene Inhalt — beim Nachladen mit Bildern bleibt der alte stehen. */
  body: MailBody | null;
  error: MailError | null;
};

type Loaded = { id: string; images: boolean; result: MailResult<MailBody> };

/** Holt HTML und Text einer Nachricht beim Dienst; die Mail bleibt dabei ungelesen. */
export function useMailBody(id: string, images: boolean): MailBodyState {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [lastGood, setLastGood] = useState<{ id: string; body: MailBody } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void mail.fetchBody(id, { images }).then((result) => {
      if (cancelled) return;
      setLoaded({ id, images, result });
      if (result.ok) setLastGood({ id, body: result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [id, images]);

  const current = loaded && loaded.id === id && loaded.images === images ? loaded.result : null;
  const body = current?.ok ? current.data : lastGood?.id === id ? lastGood.body : null;
  return {
    loading: current === null,
    body,
    error: current && !current.ok ? current.error : null,
  };
}
