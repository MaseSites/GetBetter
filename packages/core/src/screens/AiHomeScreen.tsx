import { AiChatView } from '@/features/ai/AiChatView';
import { getModule } from '@/mocks/modules';
import { EmptyState, Screen } from '@/ui';
import { useTranslate } from '@/i18n';

/** BetterAi ist eine App fuer genau eine Sache — der Chat ist die Startseite. */
export function AiHomeScreen() {
  const t = useTranslate();
  const module = getModule('ai');

  if (!module) {
    return (
      <Screen scroll={false}>
        <EmptyState
          icon="warning"
          title={t('detail.notFound.title')}
          body={t('detail.notFound.body')}
        />
      </Screen>
    );
  }

  return <AiChatView module={module} />;
}
