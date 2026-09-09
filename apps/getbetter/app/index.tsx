import { Redirect } from 'expo-router';

import { useApp } from '@/state/AppContext';

/** Verteilt beim Start auf den richtigen Bereich. Die Feinarbeit macht der RouteGuard. */
export default function Index() {
  const { account } = useApp();

  if (!account) return <Redirect href="/start" />;
  if (!account.onboarded) return <Redirect href="/welcome" />;
  return <Redirect href="/today" />;
}
