import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { suggestedModuleIds } from '@/mocks/modules';
import type { Area } from '@/mocks/types';

export const ONBOARDING_STEPS = ['welcome', 'areas', 'modules', 'household'] as const;
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
  /** Vorschlaege ergeben sich aus den gewaehlten Bereichen. */
  suggestedIds: readonly string[];
  /** Was davon nach dem Abwaehlen uebrig bleibt. */
  selectedModuleIds: readonly string[];
  toggleModule: (id: string) => void;
};

const OnboardingContext = createContext<OnboardingValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [firstName, setFirstName] = useState('');
  const [areas, setAreas] = useState<readonly Area[]>([]);
  const [deselected, setDeselected] = useState<readonly string[]>([]);

  const suggestedIds = useMemo(() => suggestedModuleIds(areas), [areas]);

  const selectedModuleIds = useMemo(
    () => suggestedIds.filter((id) => !deselected.includes(id)),
    [suggestedIds, deselected],
  );

  const toggleArea = useCallback((area: Area) => {
    setAreas((current) =>
      current.includes(area) ? current.filter((item) => item !== area) : [...current, area],
    );
  }, []);

  const toggleModule = useCallback((id: string) => {
    setDeselected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }, []);

  const value = useMemo<OnboardingValue>(
    () => ({
      firstName,
      setFirstName,
      areas,
      toggleArea,
      suggestedIds,
      selectedModuleIds,
      toggleModule,
    }),
    [firstName, areas, toggleArea, suggestedIds, selectedModuleIds, toggleModule],
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
