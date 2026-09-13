import type { TextInput } from 'react-native';

import type { NoteBlock } from '@/db/types';

import type { Focus } from './blocks';

/**
 * Wie lange ein verlorener Fokus wartet, bevor die Leiste verschwindet: so
 * lange, wie der Sprung von einem Block zum naechsten dauert.
 */
const BLUR_GRACE_MS = 150;

type CursorTarget = {
  setSelection?: (start: number, end: number) => void;
  setSelectionRange?: (start: number, end: number) => void;
};

/**
 * Was der Editor ausserhalb von React weiss: die Felder der Bloecke, wo der
 * Cursor steht, wie weit oben jeder Block liegt, und der neueste Stand der
 * Bloecke fuer Handlungen, die erst nach einem `await` weitergehen.
 */
export class EditorSession {
  private latest: readonly NoteBlock[];
  private readonly inputs = new Map<string, TextInput>();
  private readonly selections = new Map<string, { start: number; end: number }>();
  private readonly offsets = new Map<string, number>();
  private pending: Focus | null = null;
  private held = false;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(initial: readonly NoteBlock[]) {
    this.latest = initial;
  }

  get blocks(): readonly NoteBlock[] {
    return this.latest;
  }

  setBlocks(next: readonly NoteBlock[]): void {
    this.latest = next;
  }

  register(id: string, input: TextInput | null): void {
    if (input) this.inputs.set(id, input);
    else this.inputs.delete(id);
  }

  select(id: string, start: number, end: number): void {
    this.selections.set(id, { start, end });
  }

  /** Ob der Cursor ganz vorne steht — in einem leeren Block immer. */
  isAtStart(id: string, text: string): boolean {
    if (text.length === 0) return true;
    const selection = this.selections.get(id);
    return selection !== undefined && selection.start === 0 && selection.end === 0;
  }

  layout(id: string, y: number): void {
    this.offsets.set(id, y);
  }

  offsetOf(id: string): number | undefined {
    return this.offsets.get(id);
  }

  /** Setzt den Cursor, sobald das Feld dazu existiert. */
  request(focus: Focus): void {
    this.pending = focus;
    this.flush();
  }

  flush(): void {
    const pending = this.pending;
    if (!pending) return;
    const input = this.inputs.get(pending.id);
    if (!input) return;
    this.pending = null;
    input.focus();
    const target = input as unknown as CursorTarget;
    if (typeof target.setSelectionRange === 'function') {
      target.setSelectionRange(pending.cursor, pending.cursor);
    } else {
      target.setSelection?.(pending.cursor, pending.cursor);
    }
    this.selections.set(pending.id, { start: pending.cursor, end: pending.cursor });
  }

  /** Ein Knopf der Leiste wird gedrueckt: der Fokusverlust, der im Browser folgt, zaehlt nicht. */
  hold(): void {
    this.held = true;
  }

  release(): void {
    this.held = false;
  }

  focused(): void {
    this.held = false;
    this.clearBlurTimer();
  }

  blurred(onIdle: () => void): void {
    if (this.held) return;
    this.clearBlurTimer();
    this.blurTimer = setTimeout(() => {
      this.blurTimer = null;
      onIdle();
    }, BLUR_GRACE_MS);
  }

  dispose(): void {
    this.clearBlurTimer();
  }

  private clearBlurTimer(): void {
    if (this.blurTimer === null) return;
    clearTimeout(this.blurTimer);
    this.blurTimer = null;
  }
}
