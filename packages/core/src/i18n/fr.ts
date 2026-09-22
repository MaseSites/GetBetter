import type { TranslationKey } from './de';
import { frA } from './fr-a';
import { frAvatar } from './fr-avatar';
import { frB } from './fr-b';
import { frBirthdays } from './fr-birthdays';
import { frC } from './fr-c';
import { frMailUi } from './fr-mailui';
import { frNotes } from './fr-notes';
import { frFit } from './fr-fit';
import { frFit2 } from './fr-fit2';
import { frFit3 } from './fr-fit3';
import { frFit4 } from './fr-fit4';
import { frFit5 } from './fr-fit5';
import { frFit6 } from './fr-fit6';
import { frFit7 } from './fr-fit7';
import { frFit8 } from './fr-fit8';
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
  ...frFit,
  ...frFit2,
  ...frFit3,
  ...frFit4,
  ...frFit5,
  ...frFit6,
  ...frFit7,
  ...frFit8,
};
