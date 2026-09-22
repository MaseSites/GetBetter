import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { msUntilNextDay, zurichDayOf } from './zurichDay';

/** Heute in Zuerich, frisch um Mitternacht und wenn die App wieder nach vorne kommt. */
export function useZurichToday(): string {
  const [today, setToday] = useState(() => zurichDayOf());

  useEffect(() => {
    const timer = setTimeout(() => setToday(zurichDayOf()), msUntilNextDay());
    return () => clearTimeout(timer);
  }, [today]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(zurichDayOf());
    });
    return () => subscription.remove();
  }, []);

  return today;
}
