import { Redirect } from 'expo-router';

import { useApp } from '@/state/AppContext';

/** Verteilt beim Start; die Feinarbeit macht der RouteGuard in der Huelle. */
export default function Index() {
  const { account } = useApp();
  return <Redirect href={account ? '/home' : '/start'} />;
}
