import { useRouter } from 'expo-router';

import { CredentialsForm } from '@/features/auth/CredentialsForm';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';

export default function SignUpScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { signUp } = useApp();

  return (
    <CredentialsForm
      title={t('auth.signUp.title')}
      subtitle={t('auth.signUp.subtitle')}
      submitLabel={t('auth.start.createAccount')}
      switchLabel={t('auth.hasAccount')}
      onSubmit={signUp}
      onSwitch={() => router.replace('/sign-in')}
    />
  );
}
