import { useRouter } from 'expo-router';

import { SignInForm } from '@/features/auth/SignInForm';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';

export function SignInScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { signIn } = useApp();

  return (
    <SignInForm
      title={t('auth.signIn.title')}
      subtitle={t('auth.signIn.subtitle')}
      submitLabel={t('auth.start.signIn')}
      switchLabel={t('auth.noAccount')}
      bubble={t('intro.signIn.bubble')}
      onSubmit={signIn}
      onSwitch={() => router.replace('/sign-up')}
    />
  );
}
