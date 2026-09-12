import { useEffect, useEffectEvent, useState } from 'react';

import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { Input } from '@/ui';

/** Ein Name, kein Satz. */
const MAX_NAME_LENGTH = 32;

/**
 * Wie der Assistent heisst. Gespeichert wird mit „Fertig“ auf der Tastatur
 * und spaetestens beim Verlassen des Bildschirms — nicht bei jedem Buchstaben.
 */
export function AssistantNameField() {
  const t = useTranslate();
  const { account, setAssistantName } = useApp();
  const saved = account?.assistantName ?? '';
  const [draft, setDraft] = useState(saved);

  function save() {
    const next = draft.trim();
    if (next === saved) return;
    void setAssistantName(next);
  }

  // Beim Verlassen mit dem, was zuletzt im Feld stand.
  const saveOnLeave = useEffectEvent(save);
  useEffect(() => () => saveOnLeave(), []);

  return (
    <Input
      value={draft}
      onChangeText={(value) => setDraft(value.slice(0, MAX_NAME_LENGTH))}
      placeholder={t('personalize.assistant.placeholder')}
      accessibilityLabel={t('personalize.assistant.name')}
      autoCapitalize="words"
      returnKeyType="done"
      onSubmitEditing={save}
    />
  );
}
