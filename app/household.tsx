import { HouseholdView } from '@/features/household/HouseholdView';
import { useApp } from '@/state/AppContext';

export default function HouseholdScreen() {
  const { account } = useApp();
  if (!account) return null;
  return <HouseholdView />;
}
