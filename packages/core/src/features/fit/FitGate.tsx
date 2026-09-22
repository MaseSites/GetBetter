import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useI18n } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, EmptyState, Skeleton, Text } from '@/ui';

/** Platzhalter in der Hoehe dessen, was gleich kommt: Tabelle und zwei Zeilen. */
const TABLE_HEIGHT = 120;
const ROW_HEIGHT = 64;

/**
 * Was jede Ansicht von Better Fit zeigt, bevor es Daten gibt: laden, keine
 * Verbindung, oder eine Sitzung von vor den Tokens — dann einmal neu anmelden.
 */
export function FitState({
  loading,
  error,
  onRetry,
  children,
  hasData = false,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  children: ReactNode;
  /**
   * Es gibt schon Daten (etwa vom letzten Laden): ein gescheitertes Nachladen
   * verdeckt sie nicht, darueber steht nur ein schmales „Nochmal versuchen“.
   */
  hasData?: boolean;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const { signOut } = useApp();

  if (error === 'auth_required') {
    return (
      <Card>
        <View style={{ gap: theme.spacing.md }}>
          <Text variant="title">{t('fit.auth.title')}</Text>
          <Text variant="body" tone="muted">
            {t('fit.auth.body')}
          </Text>
          <Button label={t('fit.auth.action')} icon="logout" onPress={() => void signOut()} />
        </View>
      </Card>
    );
  }
  if (error && hasData && !loading) {
    return (
      <>
        <RetryBanner offline={error === 'offline'} onRetry={onRetry} />
        {children}
      </>
    );
  }
  if (error) {
    return (
      <EmptyState
        title={t(error === 'offline' ? 'fit.offline.title' : 'fit.error.title')}
        body={t(error === 'offline' ? 'fit.offline.body' : 'fit.error.body')}
        actionLabel={t('fit.retry')}
        onAction={onRetry}
      />
    );
  }
  if (loading) {
    return (
      <View style={{ gap: theme.spacing.md }} accessibilityLabel={t('fit.loading')}>
        <Skeleton height={TABLE_HEIGHT} />
        <Skeleton height={ROW_HEIGHT} />
        <Skeleton height={ROW_HEIGHT} />
      </View>
    );
  }
  return <>{children}</>;
}

/** Die schmale Zeile ueber den alten Zahlen: was los ist, und ein Knopf. */
function RetryBanner({ offline, onRetry }: { offline: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        paddingLeft: theme.spacing.lg,
        paddingRight: theme.spacing.sm,
        borderRadius: theme.radii.item,
        backgroundColor: theme.colors.dangerSoft,
      }}
    >
      <Text variant="label" tone="danger" style={{ flex: 1 }}>
        {t(offline ? 'fit4.stale.offline' : 'fit4.stale.error')}
      </Text>
      <Button label={t('fit.retry')} size="sm" variant="secondary" onPress={onRetry} />
    </View>
  );
}
