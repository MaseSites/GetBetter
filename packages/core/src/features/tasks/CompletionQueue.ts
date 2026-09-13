/** So lange bleibt eine abgehakte Zeile stehen — faengt Fehltipps ab, ohne Rueckfrage. */
export const COMPLETE_DELAY_MS = 1200;

/** Nach dem Speichern bleibt der Haken noch kurz, bis die Liste neu geladen hat. */
const SETTLE_MS = 600;

/**
 * Abhaken mit Verzoegerung. Lebt ausserhalb von React (einmal per
 * `useState(() => new CompletionQueue(...))`); gerendert wird nur, wenn sich
 * die Menge der gerade abgehakten Zeilen aendert.
 */
export class CompletionQueue {
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly finishing = new Set<string>();
  private run: (id: string) => Promise<void> | void = () => undefined;

  constructor(private readonly onChange: (ids: ReadonlySet<string>) => void) {}

  /** Die neueste Aktion, ohne die Warteschlange neu zu bauen. */
  setRunner(run: (id: string) => Promise<void> | void) {
    this.run = run;
  }

  /** Erster Tipp haekt ab, ein zweiter innert 1,2 s nimmt es zurueck. */
  toggle(id: string) {
    const timer = this.timers.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.timers.delete(id);
    } else if (!this.finishing.has(id)) {
      this.timers.set(
        id,
        setTimeout(() => this.fire(id), COMPLETE_DELAY_MS),
      );
    }
    this.emit();
  }

  /** Beim Verlassen der Ansicht: was abgehakt ist, wird sofort erledigt. */
  flush() {
    const ids = [...this.timers.keys()];
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    ids.forEach((id) => void this.run(id));
  }

  private fire(id: string) {
    this.timers.delete(id);
    this.finishing.add(id);
    void Promise.resolve(this.run(id)).finally(() => {
      setTimeout(() => {
        this.finishing.delete(id);
        this.emit();
      }, SETTLE_MS);
    });
  }

  private emit() {
    this.onChange(new Set([...this.timers.keys(), ...this.finishing]));
  }
}
