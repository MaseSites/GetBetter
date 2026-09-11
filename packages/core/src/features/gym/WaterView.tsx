import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { dayKey, drinks as drinkRepo, useLiveQuery } from '@/db';
import { useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Header, Screen, Text } from '@/ui';

/** Ein Glas sind 2.5 dl, eine Flasche 5 dl. */
export const PORTIONS = [2.5, 5] as const;
export const TARGET_DL = 20;

/** Wie viel heute getrunken wurde. Zwei Knoepfe, mehr braucht es nicht. */
export function WaterView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const today = dayKey();

  const amount = useLiveQuery(() => drinkRepo.ofDay(account.id, today), [account.id, today]);
  const dl = amount.data ?? 0;
  const share = Math.min(1, dl / TARGET_DL);

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('water.target', { target: TARGET_DL / 10 })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
      footer={
        <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
          {PORTIONS.map((portion) => (
            <View key={portion} style={{ flex: 1 }}>
              <Button
                label={t('water.add', { amount: portion })}
                icon="plus"
                onPress={() => void drinkRepo.add(account.id, today, portion)}
              />
            </View>
          ))}
        </View>
      }
    >
      <Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Text variant="display">{t('water.amount', { amount: (dl / 10).toFixed(1) })}</Text>

          {/* Ein einfacher Balken statt einer Zahl allein. */}
          <View
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
                backgroundColor: theme.colors.accent,
              }}
            />
          </View>

          <Text variant="caption" tone="muted">
            {t('water.ofTarget', { percent: Math.round(share * 100) })}
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
