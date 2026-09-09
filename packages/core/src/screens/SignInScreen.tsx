import { useRouter } from 'expo-router';

import { CredentialsForm } from '@/features/auth/CredentialsForm';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';

export function SignInScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { signIn } = useApp();

  return (
    <CredentialsForm
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      submitLabel={t('auth.start.signIn')}
      switchLabel={t('auth.noAccount')}
      onSubmit={signIn}
      onSwitch={() => router.replace('/sign-up')}
    />
  );
}
