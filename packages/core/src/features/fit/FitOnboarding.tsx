import { useEffect, useState } from 'react';
import { Animated, Platform, View } from 'react-native';

import { fit, type FitAction, type FitDay, type FitGoals, type FitProfile } from '@/db/fit';
import { useI18n, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { IconButton, Sheet, Text, useReducedMotion } from '@/ui';

import {
  EMPTY_ANSWERS,
  LatestRequest,
  answersToProfile,
  planRequest,
  profileToAnswers,
  toggleWeekday,
  withTrainingDays,
  type QuickAnswers,
} from './onboardingPlan';
import { OnboardingPlanStep } from './OnboardingPlanStep';
import {
  AimStep,
  BodyStep,
  CheckStep,
  EverydayStep,
  FoodStep,
  TrainStep,
  WhereStep,
  type StepProps,
} from './OnboardingSteps';

type Step = 'aim' | 'body' | 'everyday' | 'train' | 'where' | 'food' | 'check' | 'plan';

const useNativeDriver = Platform.OS !== 'web';

/** Die Schritte fuer diese Antworten: ohne Training faellt die Frage nach dem Studio weg. */
function stepsOf(answers: QuickAnswers): Step[] {
  return [
    'aim',
    'body',
    'everyday',
    'train',
    ...(answers.trainingDays > 0 ? (['where'] as const) : []),
    'food',
    'check',
    'plan',
  ];
}

/**
 * Better Fit in einer Minute einrichten: eine Frage je Bildschirm, grosse
 * Antworten zum Antippen, die meisten gehen nach dem Tipp gleich weiter.
 * Am Ende steht der ganze Plan — Essen, Trinken, Training — und erst
 * „Los geht's“ speichert den Trainingsplan (wie jede Aenderung: erst zeigen,
 * dann bestaetigen). Die Schritte stehen in `OnboardingSteps.tsx`.
 */
export function FitOnboarding({
  visible,
  initial,
  onClose,
}: {
  visible: boolean;
  initial: FitProfile | null;
  onClose: (done: boolean) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [answers, setAnswers] = useState<QuickAnswers>(() =>
    initial ? profileToAnswers(initial) : EMPTY_ANSWERS,
  );
  const [step, setStep] = useState<Step>('aim');
  const [busy, setBusy] = useState(false);
  const [planning, setPlanning] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [goals, setGoals] = useState<FitGoals | null>(null);
  const [today, setToday] = useState<FitDay | null>(null);
  const [action, setAction] = useState<FitAction | null>(null);
  const [enter] = useState(() => new Animated.Value(1));
  // Nur die letzte Anfrage zaehlt — fuer den Trainingsplan und fuers Profil je eine.
  const [proposals] = useState(() => new LatestRequest());
  const [saves] = useState(() => new LatestRequest());
  // Beim ersten Mal ist nichts vorgewaehlt — eine Vorauswahl saehe aus wie eine eigene Antwort.
  const [answered, setAnswered] = useState<readonly Step[]>(() =>
    initial ? ['aim', 'everyday', 'train'] : [],
  );

  const steps = stepsOf(answers);
  const index = Math.max(0, steps.indexOf(step));
  const set = (patch: Partial<QuickAnswers>) => setAnswers((current) => ({ ...current, ...patch }));

  // Jeder Schritt kommt kurz von rechts herein; bei reduzierter Bewegung nur eingeblendet.
  useEffect(() => {
    enter.setValue(0);
    Animated.timing(enter, {
      toValue: 1,
      duration: theme.motion.duration.reveal,
      easing: theme.motion.easing.out,
      useNativeDriver,
    }).start();
  }, [step, enter, theme.motion.duration.reveal, theme.motion.easing.out]);

  function go(to: Step | undefined) {
    if (to) setStep(to);
  }
  const next = (from: QuickAnswers = answers) => {
    const list = stepsOf(from);
    go(list[list.indexOf(step) + 1]);
  };
  const back = () => go(steps[index - 1]);

  /** Antwort uebernehmen und gleich weiter — nach einem Augenblick, damit man die Wahl sieht. */
  const choose = (following: QuickAnswers) => {
    setAnswers(following);
    setAnswered((current) => (current.includes(step) ? current : [...current, step]));
    setTimeout(() => next(following), reduced ? 0 : theme.motion.duration.reveal);
  };

  /** Einen Trainingsplan vorschlagen; eine spaete Antwort einer frueheren Anfrage zaehlt nicht. */
  async function proposePlan(from: QuickAnswers) {
    const ticket = proposals.begin();
    const request = planRequest(from);
    if (!request) {
      const replaced = proposals.show(null);
      if (replaced) void fit.rejectAction(replaced);
      setAction(null);
      setPlanning(false);
      return;
    }
    setPlanning(true);
    const proposed = await fit.proposeWorkoutPlan(request);
    if (!proposals.isLatest(ticket)) {
      // Veraltet: diesen Vorschlag gleich wieder verwerfen, der neuere kommt noch.
      if (proposed.ok) void fit.rejectAction(proposed.data.action.id);
      return;
    }
    const nextAction = proposed.ok ? proposed.data.action : null;
    const replaced = proposals.show(nextAction?.id ?? null);
    if (replaced) void fit.rejectAction(replaced);
    setAction(nextAction);
    setPlanning(false);
  }

  /** Profil speichern und die Ziele uebernehmen — nur die Antwort der letzten Speicherung. */
  async function saveProfile(from: QuickAnswers): Promise<boolean> {
    const ticket = saves.begin();
    const saved = await fit.saveProfile(answersToProfile(from, initial));
    if (!saves.isLatest(ticket)) return true;
    if (!saved.ok) {
      setFailure(saved.error === 'offline' ? t('fit.offline.body') : t('fit.setup.saveFailed'));
      return false;
    }
    setFailure(null);
    setGoals(saved.data.goals);
    return true;
  }

  /** Profil speichern, Tageswerte holen, Trainingsplan vorschlagen — dann steht alles auf einer Seite. */
  async function finish() {
    setBusy(true);
    setFailure(null);
    if (!(await saveProfile(answers))) {
      setBusy(false);
      return;
    }
    const [day] = await Promise.all([fit.day(), proposePlan(answers)]);
    setToday(day.ok ? day.data : null);
    setBusy(false);
    setStep('plan');
  }

  /** Ein Wochentag im Plan: die Anzahl zieht mit — also auch Profil und kcal-Verteilung. */
  function changeWeekday(weekday: number) {
    const following = toggleWeekday(answers, weekday);
    setAnswers(following);
    void saveProfile(following);
    void proposePlan(following);
  }

  async function start() {
    setBusy(true);
    if (action?.status === 'proposed') {
      const confirmed = await fit.confirmAction(action.id);
      if (!confirmed.ok) {
        setBusy(false);
        setFailure(t('fit.quick.planFailed'));
        return;
      }
    }
    setBusy(false);
    onClose(true);
  }

  function close() {
    if (action?.status === 'proposed' && step !== 'plan') void fit.rejectAction(action.id);
    onClose(step === 'plan');
  }

  const title = t(`fit.quick.q.${step}` as TranslationKey);
  const props: StepProps = {
    answers,
    set,
    pick: (patch) => choose({ ...answers, ...patch }),
    next: () => next(),
    answered: answered.includes(step),
  };

  const header = (
    <View style={{ gap: theme.spacing.md, paddingBottom: theme.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
        {index > 0 && step !== 'plan' ? (
          <IconButton icon="back" label={t('common.back')} onPress={back} />
        ) : (
          <View style={{ width: 44 }} />
        )}
        {/* Fortschritt als Striche: sichtbar, wie weit es noch ist, ohne Zahl. */}
        <View
          style={{ flex: 1, flexDirection: 'row', gap: theme.spacing.xs }}
          accessibilityLabel={t('fit.setup.progress', { step: index + 1, total: steps.length })}
        >
          {steps.map((entry, position) => (
            <View
              key={entry}
              style={{
                flex: 1,
                height: 4,
                borderRadius: theme.radii.pill,
                backgroundColor: position <= index ? theme.colors.accentMark : theme.colors.border,
              }}
            />
          ))}
        </View>
        <IconButton icon="close" label={t('common.close')} onPress={close} />
      </View>
      <Text variant="display">{title}</Text>
      {step !== 'plan' ? (
        <Text variant="body" tone="muted">
          {t(`fit.quick.sub.${step}` as TranslationKey)}
        </Text>
      ) : null}
    </View>
  );

  return (
    <Sheet visible={visible} onClose={close} fullScreen header={header}>
      <Animated.View
        style={{
          gap: theme.spacing.xl,
          paddingBottom: theme.spacing.xxl,
          opacity: enter,
          transform: reduced
            ? []
            : [
                {
                  translateX: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [theme.spacing.sm, 0],
                  }),
                },
              ],
        }}
      >
        {step === 'aim' ? <AimStep {...props} /> : null}
        {step === 'body' ? <BodyStep {...props} /> : null}
        {step === 'everyday' ? <EverydayStep {...props} /> : null}
        {step === 'train' ? (
          <TrainStep {...props} onCount={(count) => choose(withTrainingDays(answers, count))} />
        ) : null}
        {step === 'where' ? <WhereStep {...props} /> : null}
        {step === 'food' ? <FoodStep {...props} /> : null}
        {step === 'check' ? (
          <CheckStep {...props} busy={busy} failure={failure} onFinish={() => void finish()} />
        ) : null}
        {step === 'plan' && goals ? (
          <OnboardingPlanStep
            answers={answers}
            goals={goals}
            today={today}
            action={action}
            planning={planning}
            busy={busy}
            failure={failure}
            onWeekday={changeWeekday}
            onStart={() => void start()}
          />
        ) : null}
      </Animated.View>
    </Sheet>
  );
}
