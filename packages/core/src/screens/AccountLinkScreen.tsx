import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { accountUrl } from '@/app/bridge';
import { APPS, APP_IDS, currentApp, type AppId } from '@/app/identity';
import { adoptAccount as adoptLocally, decodeLink, encodeLink } from '@/auth/link';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { Button, EmptyState, Header, Screen } from '@/ui';

type State = 'working' | 'done' | 'needsSignIn' | 'broken';

function isAppId(value: string | undefined): value is AppId {
  return value !== undefined && (APP_IDS as readonly string[]).includes(value);
}

/**
 * Die Stelle, an der ein Konto von einer Better-App zur naechsten wechselt.
 *
 * - `konto?daten=…`   — hier kommt ein Konto an: uebernehmen und anmelden.
 * - `konto?zurueck=x` — App x fragt nach dem Konto: zurueckschicken.
 */
export function AccountLinkScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { account, adoptAccount } = useApp();
  const params = useLocalSearchParams<{ daten?: string; zurueck?: string }>();
  const [state, setState] = useState<State>('working');

  const incoming = params.daten;
  const asking = params.zurueck;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (incoming) {
        const payload = decodeLink(incoming);
        if (!payload) {
          if (!cancelled) setState('broken');
          return;
        }
        const local = await adoptLocally(payload);
        await adoptAccount(local);
        if (!cancelled) setState('done');
        return;
      }

      if (isAppId(asking)) {
        // Ohne eigenes Konto gibt es nichts weiterzugeben.
        if (!account) {
          if (!cancelled) setState('needsSignIn');
          return;
        }
        await Linking.openURL(accountUrl(asking, { daten: encodeLink(account) }));
        if (!cancelled) setState('done');
        return;
      }

      if (!cancelled) setState('broken');
    })();

    return () => {
      cancelled = true;
    };
  }, [incoming, asking, account, adoptAccount]);

  const app = currentApp();
  const target = isAppId(asking) ? APPS[asking].name : '';

  return (
    <Screen
      header={<Header title={app.name} subtitle={t('link.title')} />}
      footer={
        <Button
          label={t('common.done')}
          icon="check"
          onPress={() => router.replace(state === 'needsSignIn' ? '/start' : '/')}
        />
      }
    >
      {state === 'done' && incoming ? (
        <EmptyState icon="check" title={t('link.adopted')} body={t('link.adoptedBody')} />
      ) : state === 'done' ? (
        <EmptyState icon="send" title={t('link.sent', { app: target })} body={t('link.sentBody')} />
      ) : state === 'needsSignIn' ? (
        <EmptyState icon="person" title={t('link.needsSignIn')} body={t('link.needsSignInBody')} />
      ) : state === 'broken' ? (
        <EmptyState icon="warning" title={t('link.broken')} body={t('link.brokenBody')} />
      ) : (
        <EmptyState icon="clock" title={t('link.working')} body={t('link.workingBody')} />
      )}
    </Screen>
  );
}
