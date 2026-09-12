import { useRouter } from 'expo-router';

import { useTranslate } from '@/i18n';
import { EmptyState, Header, Screen } from '@/ui';

/** P-020: Auch ein falscher Pfad ist kein weisser Bildschirm. */
export default function NotFoundScreen() {
  const t = useTranslate();
  const router = useRouter();

  return (
    <Screen header={<Header showBack />} scroll={false}>
      <EmptyState
        title={t('detail.notFound.title')}
        body={t('detail.notFound.body')}
        actionLabel={t('detail.notFound.action')}
        onAction={() => router.replace('/modules')}
      />
    </Screen>
  );
}
