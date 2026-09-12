import { createContext, useContext, type ReactNode } from 'react';

/**
 * Die kleine Marke ueber dem Titel einer Vollansicht: der Bereich, etwa
 * «GESUNDHEIT». Sie sagt, wo man steht, ohne dass jede Ansicht es selbst
 * uebergeben muss — `RunModuleScreen` legt sie einmal fest, und die Kopfzeile
 * darunter liest sie.
 */
export type HeaderCrumbValue = { label: string } | null;

const HeaderCrumbContext = createContext<HeaderCrumbValue>(null);

export function HeaderCrumbProvider({
  value,
  children,
}: {
  value: HeaderCrumbValue;
  children: ReactNode;
}) {
  return <HeaderCrumbContext.Provider value={value}>{children}</HeaderCrumbContext.Provider>;
}

export function useHeaderCrumb(): HeaderCrumbValue {
  return useContext(HeaderCrumbContext);
}
