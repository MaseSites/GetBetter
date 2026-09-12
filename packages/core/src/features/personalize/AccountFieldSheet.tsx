import { useState } from 'react';
import { View } from 'react-native';

import { useTranslate, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Button, Input, Sheet } from '@/ui';

/** Ein Name, kein Satz. */
const MAX_LENGTH = 32;

export type AccountFieldSheetProps = {
  visible: boolean;
  title: string;
  /** Wie das Feld heisst. Sichtbar steht es in der Kopfzeile; hier fuer die Vorlesefunktion. */
  label: string;
  hint?: string;
  placeholder?: string;
  /** Was gespeichert ist — damit beginnt jedes Oeffnen. */
  value: string;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  /**
   * Speichert den neuen Wert. Klappt es nicht, kommt der Textschluessel des
   * Grundes zurueck — dann bleibt das Blatt offen und zeigt ihn am Feld.
   */
  onSave: (value: string) => Promise<TranslationKey | null>;
  onClose: () => void;
};

/**
 * Ein Feld des Kontos aendern: antippen, hineinschreiben, fertig. Dasselbe
 * Blatt traegt den Spitznamen und den Benutzernamen.
 */
export function AccountFieldSheet({
  visible,
  title,
  label,
  hint,
  placeholder,
  value,
  autoCapitalize = 'sentences',
  onSave,
  onClose,
}: AccountFieldSheetProps) {
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      {/*
        Jedes Oeffnen faengt beim gespeicherten Wert an: der Schluessel setzt
        das Feld neu auf — ohne Effekt, der waehrend des Rendens Zustand setzt.
      */}
      <FieldForm
        key={visible ? 'open' : 'closed'}
        label={label}
        hint={hint}
        placeholder={placeholder}
        value={value}
        autoCapitalize={autoCapitalize}
        onSave={onSave}
        onClose={onClose}
      />
    </Sheet>
  );
}

type FieldFormProps = Omit<AccountFieldSheetProps, 'visible' | 'title'>;

function FieldForm({
  label,
  hint,
  placeholder,
  value,
  autoCapitalize,
  onSave,
  onClose,
}: FieldFormProps) {
  const t = useTranslate();
  const theme = useTheme();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    setBusy(true);
    try {
      const failure = await onSave(draft);
      if (failure) {
        setError(failure);
        return;
      }
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.md }}>
      <Input
        accessibilityLabel={label}
        value={draft}
        onChangeText={(next) => {
          setDraft(next.slice(0, MAX_LENGTH));
          setError(null);
        }}
        placeholder={placeholder}
        hint={hint}
        error={error ? t(error) : undefined}
        autoCapitalize={autoCapitalize}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <Button
        label={t('common.done')}
        icon="check"
        loading={busy}
        onPress={() => {
          void save();
        }}
      />
    </View>
  );
}
