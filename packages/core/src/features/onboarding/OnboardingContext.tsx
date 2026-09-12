import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { useApp } from '@/state/AppContext';

type OnboardingValue = {
  firstName: string;
  setFirstName: (value: string) => void;
  /** Der Name fuer den Assistenten, solange er noch nicht gespeichert ist. */
  assistantName: string;
  setAssistantName: (value: string) => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

/**
 * Haelt die Entwuerfe des Einrichtens. Was das Konto schon weiss (etwa aus einer
 * anderen Better-App), steht gleich drin.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { account } = useApp();
  const [firstName, setFirstName] = useState(() => account?.firstName ?? '');
  const [assistantName, setAssistantName] = useState(() => account?.assistantName ?? '');

  const value = useMemo<OnboardingValue>(
    () => ({ firstName, setFirstName, assistantName, setAssistantName }),
    [firstName, assistantName],
  );

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error('useOnboarding muss innerhalb von OnboardingProvider verwendet werden.');
  }
  return value;
}
