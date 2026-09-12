import { useRouter } from 'expo-router';

import { SignUpForm } from '@/features/auth/SignUpForm';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';

export function SignUpScreen() {
  const t = useTranslate();
  const router = useRouter();
  const { signUp } = useApp();

  return (
    <SignUpForm
      title={t('auth.signUp.title')}
      subtitle={t('auth.signUp.subtitleFull')}
      submitLabel={t('auth.start.createAccount')}
      switchLabel={t('auth.hasAccount')}
      bubble={t('intro.signUp.bubble')}
      onSubmit={signUp}
      onSwitch={() => router.replace('/sign-in')}
    />
  );
}
