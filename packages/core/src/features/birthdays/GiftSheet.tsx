import { useState } from 'react';
import { View } from 'react-native';

import { contacts as contactRepo, newId, type ContactGift, type ContactRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Input, Sheet, useUndo } from '@/ui';

import { DangerAction } from './DangerAction';
import { addGift, editGift, removeGift } from './gifts';
import { SheetHeader } from './SheetHeader';

export type GiftEditor = { mode: 'new' } | { mode: 'edit'; gift: ContactGift } | null;

/** Eine Geschenkidee: Text, dazu freiwillig Link und Preis. */
export function GiftSheet({
  editor,
  contact,
  onClose,
}: {
  editor: GiftEditor;
  contact: ContactRow;
  onClose: () => void;
}) {
  if (!editor) return null;
  const existing = editor.mode === 'edit' ? editor.gift : null;
  return (
    <GiftSheetBody
      key={existing?.id ?? 'new'}
      existing={existing}
      contact={contact}
      onClose={onClose}
    />
  );
}

function GiftSheetBody({
  existing,
  contact,
  onClose,
}: {
  existing: ContactGift | null;
  contact: ContactRow;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const undo = useUndo();

  const [text, setText] = useState(existing?.text ?? '');
  const [url, setUrl] = useState(existing?.url ?? '');
  const [price, setPrice] = useState(existing?.price ?? '');
  const canSave = text.trim().length > 0;

  // Schliessen sichert; ohne Text bleibt alles, wie es war.
  async function saveAndClose() {
    try {
      if (canSave) {
        const input = { text, url, price };
        const gifts = existing
          ? editGift(contact.gifts, existing.id, input)
          : addGift(contact.gifts, newId('gf'), input);
        await contactRepo.update(contact.id, { gifts });
      }
    } finally {
      onClose();
    }
  }

  function remove() {
    if (!existing) return;
    const before = contact.gifts ?? [];
    onClose();
    void contactRepo.update(contact.id, { gifts: removeGift(before, existing.id) });
    undo.show({
      message: t('birthdays.gifts.removed'),
      onUndo: () => void contactRepo.update(contact.id, { gifts: before }),
    });
  }

  return (
    <Sheet
      visible
      onClose={() => void saveAndClose()}
      detent="medium"
      header={
        <SheetHeader
          title={t('birthdays.gifts.sheet')}
          saveLabel={t('birthdays.form.save')}
          canSave={canSave}
          onSave={() => void saveAndClose()}
        />
      }
    >
      <View style={{ gap: theme.spacing.lg, paddingBottom: theme.spacing.lg }}>
        <Input
          label={t('birthdays.gifts.text')}
          placeholder={t('birthdays.gifts.textPlaceholder')}
          value={text}
          onChangeText={setText}
          autoCapitalize="sentences"
        />
        <Input
          label={t('birthdays.gifts.url')}
          placeholder={t('common.optional')}
          value={url}
          onChangeText={setUrl}
          keyboardType="url"
          autoCapitalize="none"
        />
        <Input
          label={t('birthdays.gifts.price')}
          placeholder={t('birthdays.gifts.pricePlaceholder')}
          value={price}
          onChangeText={setPrice}
          autoCapitalize="none"
        />
        {existing ? <DangerAction label={t('birthdays.gifts.remove')} onPress={remove} /> : null}
      </View>
    </Sheet>
  );
}
