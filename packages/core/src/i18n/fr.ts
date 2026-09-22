import type { TranslationKey } from './de';
import { frA } from './fr-a';
import { frAvatar } from './fr-avatar';
import { frB } from './fr-b';
import { frBirthdays } from './fr-birthdays';
import { frC } from './fr-c';
import { frHome } from './fr-home';
import { frMailUi } from './fr-mailui';
import { frNotes } from './fr-notes';
import { frPlan } from './fr-plan';
import { frShell } from './fr-shell';
import { frTasks } from './fr-tasks';
import { frUi } from './fr-ui';
import { frVoice } from './fr-voice';
import { frWeather } from './fr-weather';

/** Französisch, vollstaendig: jeder Schluessel aus `de`. Fehlt einer, meldet es der Typ. */
export const fr: Readonly<Record<TranslationKey, string>> = {
  ...frA,
  ...frB,
  ...frC,
  ...frHome,
  ...frVoice,
  ...frAvatar,
  ...frShell,
  ...frTasks,
  ...frNotes,
  ...frBirthdays,
  ...frWeather,
  ...frMailUi,
  ...frUi,
  ...frPlan,
};
