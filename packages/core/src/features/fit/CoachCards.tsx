import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Animated, Pressable, View } from 'react-native';

import { fit, type FitAction } from '@/db/fit';
import type { CoachCard } from '@/db/fitTraining';
import { formatShortDate, formatWeekday, useI18n } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Icon, Text, usePressScale, type IconName } from '@/ui';

import { ActionCard } from './ActionCard';
import { trainingError } from './ExerciseBlock';
import { Block, Hairline, Pill } from './KitchenKit';
import { formatsOf } from './trainingText';
import { useFit } from './useFit';

const PILL = 40;
const LABEL_OPACITY = 0.72;

/**
 * Oben im Coach: die Hinweise des Tages, nach festen Regeln im Dienst — kein
 * KI-Aufruf, kein Kontingent. Ein verpasstes Training schlaegt „morgen
 * nachholen“ vor (als Karte zum Bestaetigen), nach dem Training steht das
 * fehlende Eiweiss da, an Trainingstagen der halbe Liter mehr. Der erste
 * Hinweis steht als dunkle Karte mit einer Handlung, die weiteren leise darunter.
 */
export function CoachCards() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const formats = formatsOf(language);
  const data = useFit(() => fit.coachToday(), [], ['training', 'diary']);
  const [action, setAction] = useState<FitAction | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const cards = data.data?.cards ?? [];
  if (cards.length === 0 && !action) return null;

  const dayText = (day: string) =>
    `${formatWeekday(language, `${day}T12:00:00`)} ${formatShortDate(language, `${day}T12:00:00`)}`;

  async function moveMissed(card: Extract<CoachCard, { kind: 'missed' }>, toDay: string) {
    const result = await fit.proposeReschedule(card.workoutId, toDay);
    if (result.ok) {
      setProblem(null);
      setAction(result.data.action);
    } else setProblem(trainingError(t, result.error));
  }

  /** Ein Hinweis als Satz und genau eine Handlung dazu. */
  const partsOf = (
    card: CoachCard,
  ): { text: string; label: string; icon: IconName; run: () => void } => {
    if (card.kind === 'missed') {
      const today = data.data?.day ?? card.tomorrow;
      return {
        text: t(card.tomorrowFree ? 'fit6.card.missed' : 'fit6.card.missedBusy', {
          title: card.title,
          day: dayText(card.day),
        }),
        label: card.tomorrowFree ? t('fit6.card.tomorrow') : t('fit6.card.today'),
        icon: 'calendar',
        run: () => void moveMissed(card, card.tomorrowFree ? card.tomorrow : today),
      };
    }
    if (card.kind === 'protein')
      return {
        text: t('fit6.card.protein', { protein: formats.whole.format(card.proteinG) }),
        label: t('fit6.card.proteinAction'),
        icon: 'meal',
        run: () => router.push('/run/nutrition'),
      };
    return {
      text: t('fit6.card.water', { target: formats.oneDecimal.format(card.targetMl / 1000) }),
      label: t('fit6.card.waterAction'),
      icon: 'water',
      run: () => router.push('/run/water'),
    };
  };

  const [first, ...more] = cards.map((card) => ({ key: card.kind, ...partsOf(card) }));

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {first ? (
        <View
          style={{
            backgroundColor: theme.colors.inverse,
            borderRadius: theme.radii.panel,
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.md,
            paddingBottom: theme.spacing.lg,
            gap: theme.spacing.md,
          }}
        >
          <View style={{ gap: theme.spacing.xs }}>
            <Text
              variant="overline"
              style={{ color: theme.colors.onInverse, opacity: LABEL_OPACITY }}
            >
              {t('fit6.card.title')}
            </Text>
            <Text
              variant="body"
              style={[
                numeric,
                {
                  color: theme.colors.onInverse,
                  fontSize: theme.fontSize.md,
                  lineHeight: theme.lineHeight.md,
                },
              ]}
            >
              {first.text}
            </Text>
          </View>
          <InversePill label={first.label} icon={first.icon} onPress={first.run} />
        </View>
      ) : null}
      {more.length > 0 ? (
        <Block flush>
          {more.map((entry, index) => (
            <View key={entry.key}>
              {index > 0 ? <Hairline /> : null}
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: theme.spacing.md,
                  paddingVertical: theme.spacing.md,
                }}
              >
                <Text variant="label" tone="muted" style={[numeric, { flex: 1 }]}>
                  {entry.text}
                </Text>
                <Pill
                  label={entry.label}
                  icon={entry.icon}
                  tone="soft"
                  size="sm"
                  onPress={entry.run}
                />
              </View>
            </View>
          ))}
        </Block>
      ) : null}
      {problem ? (
        <Text variant="label" tone="danger">
          {problem}
        </Text>
      ) : null}
      {action ? <ActionCard key={action.id} action={action} onDone={() => data.reload()} /> : null}
    </View>
  );
}

/** Die helle Pille auf der dunklen Karte — Papier auf Tinte. */
function InversePill({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon: IconName;
  onPress: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={{ alignSelf: 'flex-start' }}
    >
      <Animated.View
        style={{
          height: PILL,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.onInverse,
          transform: [{ scale: press.scale }],
        }}
      >
        <Icon name={icon} size={16} color={theme.colors.inverse} />
        <Text
          variant="label"
          numberOfLines={1}
          style={{ color: theme.colors.inverse, fontWeight: theme.fontWeight.semibold }}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
