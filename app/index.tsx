import { Redirect } from 'expo-router';

import { useApp } from '@/state/AppContext';

/** Verteilt beim Start auf den richtigen Bereich. Die Feinarbeit macht der RouteGuard. */
export default function Index() {
  const { state } = useApp();

  if (!state.signedIn) return <Redirect href="/start" />;
  if (!state.onboarded) return <Redirect href="/welcome" />;
  return <Redirect href="/today" />;
}
