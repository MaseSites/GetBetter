import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';

import { currentApp } from '@/app/identity';
import { chores as choreRepo, shopping as shoppingRepo } from '@/db/repositories';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { Button, EmptyState, Header, Screen } from '@/ui';

type Result = 'running' | 'done' | 'unknown' | 'needsHousehold';

/**
 * Hier kommen die Auftraege von GetBetter an: `betterfamily://befehl/einkauf?text=…`.
 * Der Bildschirm fuehrt sie aus und sagt, was daraus geworden ist — ohne
 * Rueckfrage waere es zu still fuer etwas, das von aussen kommt.
 */
export function CommandScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { account, household } = useApp();
  const params = useLocalSearchParams<{ command?: string; text?: string }>();
  const [result, setResult] = useState<Result>('running');

  const command = params.command ?? '';
  const text = (params.text ?? '').trim();
  const accountId = account?.id ?? null;
  const householdId = household?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    if (!accountId || text.length === 0) return;

    (async () => {
      if (command === 'einkauf') {
        await shoppingRepo.add({ accountId, householdId, name: text });
        if (!cancelled) setResult('done');
        return;
      }
      if (command === 'aemtli') {
        if (!householdId) {
          if (!cancelled) setResult('needsHousehold');
          return;
        }
        await choreRepo.create({ householdId, title: text });
        if (!cancelled) setResult('done');
        return;
      }
      if (!cancelled) setResult('unknown');
    })();

    return () => {
      cancelled = true;
    };
  }, [command, text, accountId, householdId]);

  const app = currentApp();

  return (
    <Screen
      header={<Header title={app.name} subtitle={t('command.from')} showBack />}
      footer={<Button label={t('common.done')} icon="check" onPress={() => router.replace('/')} />}
    >
      {result === 'done' ? (
        <EmptyState icon="check" title={t('command.done')} body={text} />
      ) : result === 'needsHousehold' ? (
        <EmptyState icon="people" title={t('command.needsHousehold')} body={t('command.body')} />
      ) : result === 'unknown' ? (
        <EmptyState
          icon="warning"
          title={t('command.unknown', { command })}
          body={t('command.body')}
        />
      ) : (
        <EmptyState icon="clock" title={t('command.running')} body={text} />
      )}
    </Screen>
  );
}
