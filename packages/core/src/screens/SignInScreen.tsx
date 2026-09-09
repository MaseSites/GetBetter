import * as Linking from 'expo-linking';
import { useRouter } from 'expo-router';

import { accountUrl } from '@/app/bridge';
import { APPS, currentApp } from '@/app/identity';
import { Button } from '@/ui';

import { CredentialsForm } from '@/features/auth/CredentialsForm';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';

export function SignInScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { signIn } = useApp();
  const app = currentApp();

  return (
    <CredentialsForm
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      submitLabel={t('auth.start.signIn')}
      switchLabel={t('auth.noAccount')}
      onSubmit={signIn}
      onSwitch={() => router.replace('/sign-up')}
      {...(app.id === 'getbetter'
        ? {}
        : {
            extra: (
              <Button
                label={t('link.fromApp', { app: APPS.getbetter.name })}
                variant="ghost"
                icon="people"
                onPress={() => void Linking.openURL(accountUrl('getbetter', { zurueck: app.id }))}
              />
            ),
          })}
    />
  );
}
