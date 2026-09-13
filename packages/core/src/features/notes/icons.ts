import { isIconName, type IconName } from '@/ui';

/**
 * Symbole, die der feste Satz in `ui/Icon.tsx` noch nicht fuehrt. Kommt dort
 * einer dazu (`share`, `more`, `folder`, …), nimmt ihn die Notiz von selbst;
 * bis dahin steht das naechstbeste Symbol aus dem Satz.
 */
function prefer(name: string, fallback: IconName): IconName {
  return isIconName(name) ? name : fallback;
}

export const NOTE_ICONS = {
  share: prefer('share', 'upload'),
  more: prefer('more', 'lines'),
  folder: prefer('folder', 'inbox'),
  keyboardDown: prefer('keyboardDown', 'down'),
  format: prefer('format', 'note'),
  tag: prefer('tag', 'at'),
  indent: prefer('indent', 'forward'),
  outdent: prefer('outdent', 'back'),
  select: prefer('select', 'checkbox'),
  restore: prefer('restore', 'refresh'),
} as const satisfies Record<string, IconName>;
