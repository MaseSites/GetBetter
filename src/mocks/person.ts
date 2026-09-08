import type { Household, Person } from './types';

export const PERSON: Person = {
  id: 'p-1',
  firstName: 'Lea',
  email: 'lea@beispiel.ch',
  subscriptionPlan: 'Haushalt',
  subscriptionRenewsAt: '2026-10-01T00:00:00.000Z',
};

export const HOUSEHOLD: Household = {
  id: 'h-1',
  name: 'Zuhause',
  members: [
    { id: 'm-1', name: 'Lea Meier', role: 'owner' },
    { id: 'm-2', name: 'Jonas Meier', role: 'adult' },
    { id: 'm-3', name: 'Nora Meier', role: 'teen' },
  ],
};
