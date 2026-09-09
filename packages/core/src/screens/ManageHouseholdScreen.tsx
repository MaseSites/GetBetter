import { HouseholdView } from '@/features/household/HouseholdView';
import { useApp } from '@/state/AppContext';

export function ManageHouseholdScreen() {
  const { account } = useApp();
  if (!account) return null;
  return <HouseholdView />;
}
