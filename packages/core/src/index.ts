/**
 * Der gemeinsame Kern aller Better-Apps: Speicher, Konten, Bausteine, Sprache
 * und Theme. Die Apps holen sich daraus, was sie brauchen — importiert wird
 * ueber den Alias `@/…`, den jede App auf diesen Ordner zeigen laesst.
 */
export * from './db';
export * from './ui';
export * from './theme';
