import { View } from 'react-native';

import type { AiBudget } from '@/db/ai';
import { formatPercent, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { ProgressBar } from '@/ui';

import { SettingsRow } from './SettingsList';

/** Ab hier steht der Balken rot: das Kontingent ist fast weg. */
const WARN_SHARE = 0.9;

/**
 * „KI diesen Monat“: Gratis oder Abo, wie viel davon genutzt ist — als Prozent
 * und kleiner Balken, nie in Franken. Wann es wieder voll ist, steht als
 * Hinweis unter der Gruppe.
 */
export function AiUsageRow({ budget, first }: { budget: AiBudget; first: boolean }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const used = Math.min(1, Math.max(0, 1 - budget.remainingShare));

  return (
    <SettingsRow
      first={first}
      icon="sparkles"
      label={t('settings.ai.month')}
      value={t('settings.ai.value', {
        plan: t(budget.plan === 'paid' ? 'settings.ai.plan.paid' : 'settings.ai.plan.trial'),
        share: formatPercent(language, used),
      })}
      trailing={
        <View style={{ width: theme.spacing.xxl + theme.spacing.lg }}>
          <ProgressBar share={used} warn={used >= WARN_SHARE} />
        </View>
      }
    />
  );
}
