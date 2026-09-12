import { getModule } from '@/mocks/modules';
import { useTranslate } from '@/i18n';
import { CalendarView } from '@/features/calendar/CalendarView';
import { EmptyState, Screen } from '@/ui';

/** Der Kalender als eigener Tab — in BetterFamily der Familienkalender. */
export function CalendarScreen() {
  const t = useTranslate();
  const module = getModule('calendar');

  if (!module) {
    return (
      <Screen scroll={false}>
        <EmptyState title={t('detail.notFound.title')} body={t('detail.notFound.body')} />
      </Screen>
    );
  }

  return <CalendarView module={module} showBack={false} />;
}
