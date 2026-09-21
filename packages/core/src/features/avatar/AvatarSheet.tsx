import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { usePlanSheet } from '@/features/plan/PlanSheet';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Sheet, Text } from '@/ui';

import { AvatarPicker } from './AvatarPicker';
import type { AvatarStyle } from './style';
import { useAvatarStyle } from './useAvatarStyle';

/** Gross genug, dass man Augen und Zubehoer gut erkennt. */
const PREVIEW = 148;

export type AvatarSheetProps = {
  visible: boolean;
  onClose: () => void;
};

/**
 * Den Avatar gestalten: oben er selbst, lebendig, darunter Figur, Farbe, Augen
 * und Zubehoer. Jeder Tipp zeigt sich sofort und wird sofort gespeichert —
 * es gibt nichts, das beim Schliessen verloren gehen koennte.
 */
export function AvatarSheet({ visible, onClose }: AvatarSheetProps) {
  const t = useTranslate();
  const theme = useTheme();
  const { personal, setAssistantAvatar } = useApp();
  const plan = usePlanSheet();
  const saved = useAvatarStyle();
  // Die Vorschau wartet nicht auf die Ablage: was getippt ist, steht schon da.
  const [draft, setDraft] = useState<AvatarStyle | null>(null);
  const shown = draft ?? saved;
  const name = personal.assistantName;

  function change(next: AvatarStyle) {
    // Ohne Abo bleibt der Roboter: statt zu speichern, zeigt es das Abo.
    if (!personal.canPersonalize) {
      close();
      plan.open();
      return;
    }
    setDraft(next);
    void setAssistantAvatar(next);
  }

  function close() {
    setDraft(null);
    onClose();
  }

  return (
    <Sheet visible={visible} onClose={close} title={t('avatar.title')}>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={[styles.stage, { gap: theme.spacing.xs }]}>
          {/* Wechselt die Figur, setzt er sich neu zusammen. */}
          <ClubAvatar size={PREVIEW} phase="assemble" gazeOnly style={shown} />
          <Text variant="title" align="center">
            {name || t(`avatar.kind.${shown.kind}`)}
          </Text>
          <Text variant="caption" tone="faint" align="center">
            {t('avatar.hint')}
          </Text>
        </View>
        <AvatarPicker value={shown} onChange={change} />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  stage: { alignItems: 'center' },
});
