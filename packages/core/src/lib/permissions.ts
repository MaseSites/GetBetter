import { formatList, type Language, type Translate, type TranslationKey } from '@/i18n';
import type { DataScope, ModulePermissions } from '@/mocks/types';

function scopeKey(scope: DataScope): TranslationKey {
  return `permission.data.${scope}` as TranslationKey;
}

/**
 * P-014: Aus den Daten erzeugte Saetze, nicht von Hand geschriebene.
 * "Liest deine Termine und deinen Haushalt. Schreibt deine Aufgaben."
 */
export function permissionSentences(
  permissions: ModulePermissions,
  t: Translate,
  language: Language,
): readonly string[] {
  const sentences: string[] = [];

  if (permissions.read.length > 0) {
    const list = formatList(
      language,
      permissions.read.map((scope) => t(scopeKey(scope))),
    );
    sentences.push(t('permission.read', { list }));
  }

  if (permissions.write.length > 0) {
    const list = formatList(
      language,
      permissions.write.map((scope) => t(scopeKey(scope))),
    );
    sentences.push(t('permission.write', { list }));
  }

  return sentences;
}
