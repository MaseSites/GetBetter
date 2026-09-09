import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import { AiChatView } from '@/features/ai/AiChatView';
import { AlarmView } from '@/features/alarm/AlarmView';
import { CalendarView } from '@/features/calendar/CalendarView';
import { ChoresView } from '@/features/chores/ChoresView';
import { FitnessView } from '@/features/gym/FitnessView';
import { MealsView } from '@/features/gym/MealsView';
import { WaterView } from '@/features/gym/WaterView';
import { BillsView } from '@/features/money/BillsView';
import { BudgetView } from '@/features/money/BudgetView';
import { SavingsView } from '@/features/money/SavingsView';
import { SubscriptionsView } from '@/features/money/SubscriptionsView';
import { PetsView } from '@/features/family/PetsView';
import { PlantsView } from '@/features/family/PlantsView';
import { RecipesView } from '@/features/family/RecipesView';
import { VehiclesView } from '@/features/family/VehiclesView';
import { NotesView } from '@/features/notes/NotesView';
import { ContactsView } from '@/features/organizer/ContactsView';
import { DocumentsView } from '@/features/organizer/DocumentsView';
import { HabitsView } from '@/features/organizer/HabitsView';
import { TripsView } from '@/features/organizer/TripsView';
import { ShoppingView } from '@/features/shopping/ShoppingView';
import { TasksView } from '@/features/tasks/TasksView';
import { useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { getModule } from '@/mocks/modules';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { Button, Card, EmptyState, Header, Icon, Screen, Text } from '@/ui';

/** Module, die schon wirklich etwas tun. Der Rest bekommt den Platzhalter. */
const BUILT: Record<string, (module: ModuleDefinition) => React.ReactElement> = {
  calendar: (module) => <CalendarView module={module} />,
  tasks: (module) => <TasksView module={module} />,
  notes: (module) => <NotesView module={module} />,
  shopping: (module) => <ShoppingView module={module} />,
  alarm: (module) => <AlarmView module={module} />,
  chores: (module) => <ChoresView module={module} />,
  ai: (module) => <AiChatView module={module} />,
  fitness: (module) => <FitnessView module={module} />,
  meals: (module) => <MealsView module={module} />,
  water: (module) => <WaterView module={module} />,
  budget: (module) => <BudgetView module={module} />,
  bills: (module) => <BillsView module={module} />,
  subscriptions: (module) => <SubscriptionsView module={module} />,
  savings: (module) => <SavingsView module={module} />,
  documents: (module) => <DocumentsView module={module} />,
  habits: (module) => <HabitsView module={module} />,
  travel: (module) => <TripsView module={module} />,
  contacts: (module) => <ContactsView module={module} />,
  recipes: (module) => <RecipesView module={module} />,
  plants: (module) => <PlantsView module={module} />,
  pets: (module) => <PetsView module={module} />,
  vehicles: (module) => <VehiclesView module={module} />,
};

/** Noch nicht gebaut — ehrlich gesagt statt mit erfundenen Zahlen gefuellt. */
function PlaceholderModule({ module }: { module: ModuleDefinition }) {
  const { t } = useI18n();
  const theme = useTheme();
  const router = useRouter();

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={module.short}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/'))}
        />
      }
      footer={
        <Button
          label={t('modules.sheet.details')}
          variant="secondary"
          icon="info"
          onPress={() => router.push(`/module/${module.id}`)}
        />
      }
    >
      <Card>
        <View style={{ alignItems: 'center', gap: theme.spacing.md }}>
          <Icon name={module.icon} size={28} color={theme.colors.textFaint} />
          <Text variant="title" align="center">
            {t('moduleScreen.placeholder.title')}
          </Text>
          <Text variant="label" tone="muted" align="center">
            {t('moduleScreen.placeholder.body')}
          </Text>
        </View>
      </Card>

      <Card title={t('detail.about')}>
        <Text variant="body" tone="muted">
          {module.description}
        </Text>
      </Card>
    </Screen>
  );
}

export function RunModuleScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { account } = useApp();

  const params = useLocalSearchParams<{ id?: string }>();
  const module = params.id ? getModule(params.id) : undefined;

  // Beim Abmelden steht dieser Bildschirm kurz ohne Konto da.
  if (!account) return null;

  if (!module) {
    return (
      <Screen header={<Header showBack />} scroll={false}>
        <EmptyState
          icon="warning"
          title={t('detail.notFound.title')}
          body={t('detail.notFound.body')}
          actionLabel={t('detail.notFound.action')}
          onAction={() => router.replace('/apps')}
        />
      </Screen>
    );
  }

  const build = BUILT[module.id];
  return build ? build(module) : <PlaceholderModule module={module} />;
}
