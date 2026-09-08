import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import type { Area } from '@/mocks/types';

export const ONBOARDING_STEPS = ['welcome', 'areas', 'household'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export function stepNumber(step: OnboardingStep): number {
  return ONBOARDING_STEPS.indexOf(step) + 1;
}

export const ONBOARDING_STEP_COUNT = ONBOARDING_STEPS.length;

type OnboardingValue = {
  firstName: string;
  setFirstName: (value: string) => void;
  areas: readonly Area[];
  toggleArea: (area: Area) => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [firstName, setFirstName] = useState('');
  const [areas, setAreas] = useState<readonly Area[]>([]);

  const toggleArea = useCallback((area: Area) => {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    );
  }, []);

  const value = useMemo<OnboardingValue>(
    () => ({ firstName, setFirstName, areas, toggleArea }),
    [firstName, areas, toggleArea],
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
