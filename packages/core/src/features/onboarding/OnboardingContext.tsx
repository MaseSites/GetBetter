import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/** Ein Schritt reicht: der Vorname. Bereiche und Favoriten gibt es nicht mehr. */
export const ONBOARDING_STEPS = ['welcome'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function stepNumber(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

type OnboardingValue = {
  firstName: string;
  setFirstName: (value: string) => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [firstName, setFirstName] = useState('');

  const value = useMemo<OnboardingValue>(() => ({ firstName, setFirstName }), [firstName]);

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingValue {
  const value = useContext(OnboardingContext);
  if (!value) {
    throw new Error('useOnboarding muss innerhalb von OnboardingProvider verwendet werden.');
  }
  return value;
}
