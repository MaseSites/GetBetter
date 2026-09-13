import type { NoteBlock } from '../../db/types';
import { isBlank } from './blocks';

/** Gesichert wird so lange nach der letzten Eingabe. */
export const SAVE_DELAY_MS = 500;

export type DraftStore = {
  /** Legt die Notiz an und gibt ihre Id zurueck. */
  create: (blocks: readonly NoteBlock[]) => Promise<string>;
  save: (id: string, blocks: readonly NoteBlock[]) => Promise<void>;
  /** Wirft eine neue, leer gebliebene Notiz weg. */
  discard: (id: string) => Promise<void>;
};

export type DraftTimers = {
  set: (run: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const systemTimers: DraftTimers = {
  set: (run, ms) => setTimeout(run, ms),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

export type DraftOptions = {
  store: DraftStore;
  /** Null bei einer neuen Notiz: sie entsteht erst mit dem ersten Zeichen. */
  noteId: string | null;
  timers?: DraftTimers;
  onError?: (error: unknown) => void;
  /** Sobald eine neue Notiz angelegt ist. */
  onCreated?: (id: string) => void;
};

/**
 * Das Sichern im Editor, ausserhalb von React. Eine neue Notiz entsteht mit
 * dem ersten Zeichen, danach wird 500 ms nach der letzten Eingabe gesichert.
 * Beim Verlassen wird alles Offene geschrieben — und eine neue Notiz, in der
 * nichts steht, verschwindet ohne Rueckfrage.
 */
export class NoteDraft {
  private noteId: string | null;
  private readonly isNew: boolean;
  private readonly store: DraftStore;
  private readonly timers: DraftTimers;
  private readonly onError: (error: unknown) => void;
  private readonly onCreated: (id: string) => void;
  private current: readonly NoteBlock[] | null = null;
  private unsaved: readonly NoteBlock[] | null = null;
  private timer: unknown = null;
  private creating = false;
  private queue: Promise<void> = Promise.resolve();

  constructor(options: DraftOptions) {
    this.noteId = options.noteId;
    this.isNew = options.noteId === null;
    this.store = options.store;
    this.timers = options.timers ?? systemTimers;
    this.onError = options.onError ?? (() => undefined);
    this.onCreated = options.onCreated ?? (() => undefined);
  }

  get id(): string | null {
    return this.noteId;
  }

  /** Nach jeder Aenderung der Bloecke. */
  change(blocks: readonly NoteBlock[]): void {
    this.current = blocks;
    this.unsaved = blocks;
    if (this.noteId === null && !this.creating) {
      if (isBlank(blocks)) return;
      this.creating = true;
      this.enqueue();
      return;
    }
    this.clearTimer();
    this.timer = this.timers.set(() => {
      this.timer = null;
      this.enqueue();
    }, SAVE_DELAY_MS);
  }

  /** Schreibt sofort, was offen ist, und gibt die Id zurueck — null, solange nichts drinsteht. */
  async commit(): Promise<string | null> {
    this.clearTimer();
    this.enqueue();
    await this.queue;
    return this.noteId;
  }

  /** Beim Verlassen des Editors. */
  async leave(): Promise<void> {
    await this.commit();
    if (this.isNew && this.noteId !== null && this.current && isBlank(this.current)) {
      const id = this.noteId;
      this.noteId = null;
      await this.store.discard(id).catch(this.onError);
    }
  }

  private clearTimer(): void {
    if (this.timer === null) return;
    this.timers.clear(this.timer);
    this.timer = null;
  }

  private enqueue(): void {
    this.queue = this.queue.then(() => this.write()).catch(this.onError);
  }

  private async write(): Promise<void> {
    const blocks = this.unsaved;
    if (!blocks) return;
    this.unsaved = null;
    if (this.noteId !== null) {
      await this.store.save(this.noteId, blocks);
      return;
    }
    if (isBlank(blocks)) {
      this.creating = false;
      return;
    }
    try {
      const id = await this.store.create(blocks);
      this.noteId = id;
      this.onCreated(id);
    } finally {
      this.creating = false;
    }
  }
}
