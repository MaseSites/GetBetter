import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { fit } from '@/db/fit';
import { useI18n } from '@/i18n';
import { moduleName } from '@/mocks/moduleText';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Screen } from '@/ui';

import { AreaHeader, PillTabs } from './KitchenKit';
import { PantryPanel } from './PantryPanel';
import { PlanPanel } from './PlanPanel';
import { RecipesPanel } from './RecipesPanel';
import { ShoppingPanel } from './ShoppingPanel';
import { useFit } from './useFit';

type Tab = 'pantry' | 'recipes' | 'plan' | 'shopping';
const TABS = ['pantry', 'recipes', 'plan', 'shopping'] as const;
/** Kopf bis Reiter: 12 Innenabstand des Kopfs plus 2 — wie die 14 der Vision. */
const TABS_TOP = 2;

const zurichToday = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Zurich' }).format(new Date());

/**
 * Die Kueche: was da ist, was sich daraus kochen laesst, was diese Woche auf
 * den Tisch kommt und was dafuer noch fehlt — alles verbunden. Oben der Kopf
 * des Bereichs, darunter die vier Reiter als Pillen-Spur.
 */
export function KitchenView({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('recipes');
  const status = useFit(() => fit.status(), [], ['profile']);
  const name = moduleName(t, module.id);

  return (
    <Screen
      gap={0}
      contentStyle={{ paddingTop: TABS_TOP }}
      header={
        <AreaHeader
          crumb={`${t('area.health')} · ${name}`}
          title={name}
          subtitle={TABS.map((value) => t(`fit.kitchen.tab.${value}`)).join(' · ')}
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
    >
      <PillTabs
        options={TABS.map((value) => ({ value, label: t(`fit.kitchen.tab.${value}`) }))}
        value={tab}
        onChange={setTab}
        accessibilityLabel={name}
      />
      {tab === 'recipes' ? <RecipesPanel day={zurichToday()} /> : null}
      {tab !== 'recipes' ? (
        <View style={{ marginTop: theme.spacing.md }}>
          {tab === 'pantry' ? (
            <PantryPanel mock={status.data?.mode === 'mock'} day={zurichToday()} />
          ) : null}
          {tab === 'plan' ? <PlanPanel /> : null}
          {tab === 'shopping' ? <ShoppingPanel /> : null}
        </View>
      ) : null}
    </Screen>
  );
}
