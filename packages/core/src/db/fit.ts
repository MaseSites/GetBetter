/**
 * Better Fit im Dienst (`services/api/fit`, Routen `/v1/fit/…`).
 *
 * Diese Daten liegen **nicht** im gemeinsamen Speicher (`db/store.ts`): sie
 * sind persoenlich und gehen nur mit dem Sitzungs-Token hinaus. Die App
 * schickt Lebensmittel und Gramm — rechnen tut nur der Dienst.
 *
 * Aufgeteilt nach Bereich: `fitDiary.ts`, `fitKitchen.ts`, `fitTraining.ts`;
 * Aenderungen melden und Sprache in `fitEvents.ts`.
 */

import { fitCall, changedFor, idempotencyKey, q } from './fitEvents';
import { fitDiary } from './fitDiary';
import { fitKitchen } from './fitKitchen';
import { fitTraining } from './fitTraining';
import type { ChangeRow, FitAction, FitDay, FitGoals, FitProfile, FitStatus } from './fitTypes';

export * from './fitTypes';
export type { FitSuggestion, MealItemInput, RecentFood } from './fitDiary';
export { idempotencyKey, onFitChanged, setFitLanguage, type FitTopic } from './fitEvents';

const changed = changedFor('all');

const fitCore = {
  status: () => fitCall<FitStatus>('/v1/fit/status'),

  profile: () =>
    fitCall<{ profile: FitProfile | null; goals: FitGoals | null; kcalAdjustment: number }>(
      '/v1/fit/profile',
    ),

  async saveProfile(profile: Partial<FitProfile>) {
    return changed(
      await fitCall<{ profile: FitProfile; goals: FitGoals }>('/v1/fit/profile', {
        method: 'PUT',
        body: profile,
      }),
    );
  },

  day: (day?: string) => fitCall<FitDay>(`/v1/fit/day${day ? `?day=${q(day)}` : ''}`),

  changes: (table?: string) =>
    fitCall<{ changes: ChangeRow[] }>(`/v1/fit/changes${table ? `?table=${q(table)}` : ''}`),

  async undo(changeId: string) {
    return changed(
      await fitCall<{ ok: true }>(`/v1/fit/changes/${q(changeId)}/undo`, { method: 'POST' }),
    );
  },

  // Vorschlaege: jede Aenderung an Vorrat, Rezepten, Plan, Liste und Training.
  actions: (status?: string) =>
    fitCall<{ actions: FitAction[] }>(`/v1/fit/actions${status ? `?status=${q(status)}` : ''}`),

  propose: (tool: string, args: Record<string, unknown>) =>
    fitCall<{ action: FitAction }>('/v1/fit/actions', { method: 'POST', body: { tool, args } }),

  async confirmAction(id: string) {
    return changed(
      await fitCall<{ action: FitAction; preview?: FitAction['preview'] }>(
        `/v1/fit/actions/${q(id)}/confirm`,
        { method: 'POST', headers: { 'Idempotency-Key': idempotencyKey('confirm') } },
      ),
    );
  },

  async rejectAction(id: string) {
    return changed(
      await fitCall<{ action: FitAction }>(`/v1/fit/actions/${q(id)}/reject`, {
        method: 'POST',
      }),
    );
  },

  async deleteAll() {
    return changed(
      await fitCall<{ ok: true }>('/v1/fit/data', {
        method: 'DELETE',
        body: { confirm: 'DELETE' },
      }),
    );
  },
};

export const fit = { ...fitCore, ...fitDiary, ...fitKitchen, ...fitTraining };
