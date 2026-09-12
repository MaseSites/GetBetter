import { Component, type ErrorInfo, type ReactNode } from 'react';

import { useTranslate } from '@/i18n';
import { EmptyState, Screen } from '@/ui';

type Props = { children: ReactNode };
type State = { failed: boolean };

/** Was statt des weissen Blatts steht, wenn etwas wirklich schiefgeht. */
function Fallback({ onRetry }: { onRetry: () => void }) {
  const t = useTranslate();
  return (
    <Screen scroll={false} contentStyle={{ flex: 1, justifyContent: 'center' }}>
      <EmptyState
        title={t('error.title')}
        body={t('error.body')}
        actionLabel={t('error.retry')}
        onAction={onRetry}
      />
    </Screen>
  );
}

/**
 * Faengt, was in einem Bildschirm wirft, damit die App nie leer bleibt.
 * Eine Klasse, weil React Fehler nur dort abfaengt.
 */
export class ErrorBoundary extends Component<Props, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // In der Entwicklung soll man den Fehler sehen; im Bau geht er nirgendwo hin.
    if (__DEV__) console.error(error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.failed) {
      return <Fallback onRetry={() => this.setState({ failed: false })} />;
    }
    return this.props.children;
  }
}
