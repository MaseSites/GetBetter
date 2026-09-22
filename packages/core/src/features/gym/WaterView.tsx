import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { drinks as drinkRepo, useLiveQuery } from '@/db';
import { fit } from '@/db/fit';
import { formatsOf } from '@/features/fit/trainingText';
import { useFit } from '@/features/fit/useFit';
import { useZurichToday } from '@/features/fit/useZurichToday';
import { useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Header, Screen, Text } from '@/ui';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';

/** Ein Glas sind 2.5 dl, eine Flasche 5 dl. */
export const PORTIONS = [2.5, 5] as const;
export const TARGET_DL = 20;

/** Wie viel heute getrunken wurde. Zwei Knoepfe, mehr braucht es nicht. */
export function WaterView({ module }: { module: ModuleDefinition }) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const celebrate = useCelebrate();
  const router = useRouter();
  const account = useAccount();
  // Der Tag endet in Zuerich um Mitternacht — wie beim Dienst und in Better Fit.
  const today = useZurichToday();
  const formats = formatsOf(language);

  const amount = useLiveQuery(() => drinkRepo.ofDay(account.id, today), [account.id, today]);
  const dl = amount.data ?? 0;
  // Mit Better Fit ist das Ziel persoenlich: nach Gewicht, an Trainingstagen mehr.
  const fitDay = useFit(
    () => fit.day(today),
    [account.id, today],
    ['diary', 'training', 'profile'],
  );
  const target = fitDay.data?.hasProfile ? fitDay.data.waterTargetMl / 100 : TARGET_DL;
  const share = Math.min(1, dl / target);

  return (
    <Screen
      header={
        <Header
          title={moduleName(t, module.id)}
          subtitle={t('water.target', { target: formats.oneDecimal.format(target / 10) })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
      footer={
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {PORTIONS.map((portion) => (
            <View key={portion} style={{ flex: 1 }}>
              <Button
                label={t('water.add', { amount: formats.oneDecimal.format(portion) })}
                icon="plus"
                onPress={() => {
                  celebrate('water');
                  void drinkRepo.add(account.id, today, portion);
                }}
              />
            </View>
          ))}
        </View>
      }
    >
      <Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="display">
            {t('water.amount', { amount: formats.oneDecimal.format(dl / 10) })}
          </Text>

          {/* Ein einfacher Balken statt einer Zahl allein — vorgelesen als Fortschritt. */}
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={t('fit6.water.a11y', {
              amount: formats.oneDecimal.format(dl / 10),
              target: formats.oneDecimal.format(target / 10),
            })}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
            style={{
              width: '100%',
              height: 10,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surfaceMuted,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                width: `${share * 100}%`,
                height: '100%',
                backgroundColor: theme.colors.accentMark,
              }}
            />
          </View>

          <Text variant="caption" tone="muted">
            {t('water.ofTarget', { percent: formats.whole.format(Math.round(share * 100)) })}
          </Text>
        </View>
      </Card>

      {dl > 0 ? (
        <Button
          label={t('water.undo')}
          variant="ghost"
          icon="back"
          onPress={() => void drinkRepo.undoLast(account.id, today)}
        />
      ) : null}
    </Screen>
  );
}
