import { useLocalSearchParams, useRouter } from 'expo-router';

import { AiChatView } from '@/features/ai/AiChatView';
import { useTranslate } from '@/i18n';
import { getModule } from '@/mocks/modules';
import { useApp } from '@/state/AppContext';
import { EmptyState, Header, Screen } from '@/ui';

/** Ein Gespraech aus der Liste von BetterAi, ueber seine Id. */
export function AiChatScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { account } = useApp();
  const params = useLocalSearchParams<{ id?: string }>();
  const module = getModule('ai');

  // Beim Abmelden steht dieser Bildschirm kurz ohne Konto da.
  if (!account) return null;

  if (!module || !params.id) {
    return (
      <Screen header={<Header showBack />} scroll={false}>
        <EmptyState
          icon="warning"
          title={t('detail.notFound.title')}
          body={t('detail.notFound.body')}
          actionLabel={t('detail.notFound.action')}
          onAction={() => router.replace('/')}
        />
      </Screen>
    );
  }

  return <AiChatView module={module} chatId={params.id} />;
}
