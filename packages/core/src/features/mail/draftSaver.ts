// Relative Pfade mit Absicht: so laeuft die Datei auch in den Tests unter Node.
import type { MailDraftInput, MailResult } from '../../db/mail';

export type SaveDraft = (input: MailDraftInput) => Promise<MailResult<{ draftId: string }>>;

/**
 * Sichert Entwuerfe nacheinander — nie zwei gleichzeitig, sonst laegen zwei
 * Fassungen im Entwurfsordner — und merkt sich die `draftId`, die der Dienst
 * zuletzt vergeben hat. Lebt ausserhalb von React: gerendert wird dabei nichts.
 */
export class DraftSaver {
  private readonly saveDraft: SaveDraft;
  private draftId: string | null = null;
  private lastSignature: string | null = null;
  private running: Promise<unknown> = Promise.resolve();
  private stopped = false;

  constructor(saveDraft: SaveDraft) {
    this.saveDraft = saveDraft;
  }

  /** Ein neues Blatt: mit dem Entwurf, aus dem es kommt, und dem Stand, der schon gesichert ist. */
  reset(draftId: string | null, signature: string | null) {
    this.draftId = draftId;
    this.lastSignature = signature;
    this.stopped = false;
    this.running = Promise.resolve();
  }

  get id(): string | null {
    return this.draftId;
  }

  /** Sichert, wenn sich seit dem letzten Mal etwas geaendert hat. `false`, wenn es scheiterte. */
  save(
    signature: string,
    build: (draftId: string | null) => MailDraftInput | null,
  ): Promise<boolean> {
    // Was vor `finish` verlangt wurde, laeuft noch — danach nichts mehr.
    if (this.stopped) return Promise.resolve(true);
    const next = this.running.then(async () => {
      if (signature === this.lastSignature) return true;
      const input = build(this.draftId);
      if (!input) return false;
      const result = await this.saveDraft(input);
      // Auch wenn inzwischen gesendet wird: die Id gehoert dazu, sonst bliebe der Entwurf liegen.
      if (result.ok) {
        this.draftId = result.data.draftId;
        this.lastSignature = signature;
      }
      return result.ok;
    });
    this.running = next.catch(() => false);
    return next.catch(() => false);
  }

  /** Ab jetzt wird nichts mehr gesichert; wartet die laufende Sicherung ab. */
  async finish(): Promise<string | null> {
    this.stopped = true;
    await this.running;
    return this.draftId;
  }

  /** Senden scheiterte: das Blatt bleibt offen und sichert wieder. */
  resume() {
    this.stopped = false;
  }
}
