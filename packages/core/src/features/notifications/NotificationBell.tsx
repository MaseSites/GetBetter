import { useRouter } from 'expo-router';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { notifications as notificationRepo, useLiveQuery } from '@/db';
import { formatNumber, useI18n } from '@/i18n';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Icon, Text, usePressScale } from '@/ui';

/** So gross wie die runden Knoepfe im Kopf. */
const BELL_SIZE = 40;
const BELL_ICON = 18;
const BADGE_SIZE = 18;
/** Der Ring in der Farbe des Grunds trennt das Abzeichen vom Knopf. */
const BADGE_RING = 2;
const BADGE_OFFSET = -3;
/** Darueber steht "9+" — breiter wird das Abzeichen nicht. */
const BADGE_MAX = 9;

/**
 * Die Glocke: ein runder Knopf wie Zurueck und Zahnrad, mit der Zahl der
 * ungelesenen Mitteilungen. Ein Tipp oeffnet die Mitteilungen.
 */
export function NotificationBell() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const press = usePressScale();

  const unread = useLiveQuery(() => notificationRepo.unread(account.id), [account.id]);
  const count = unread.data?.length ?? 0;
  const badge =
    count > BADGE_MAX
      ? t('news.bell.many', { count: formatNumber(language, BADGE_MAX) })
      : formatNumber(language, count);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('news.bell.label', { count })}
      onPress={() => router.push('/notifications')}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      hitSlop={theme.spacing.xs}
    >
      <Animated.View
        style={[
          styles.round,
          theme.elevation.card,
          {
            borderRadius: theme.radii.pill,
            backgroundColor: theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Icon name={count > 0 ? 'bellFilled' : 'bell'} size={BELL_ICON} color={theme.colors.text} />
      </Animated.View>
      {count > 0 ? (
        <View
          style={[
            styles.badge,
            {
              borderRadius: theme.radii.pill,
              paddingHorizontal: theme.spacing.xs,
              backgroundColor: theme.colors.inverse,
              borderColor: theme.colors.background,
            },
          ]}
        >
          <Text
            style={{
              color: theme.colors.onInverse,
              fontSize: theme.fontSize.micro,
              lineHeight: theme.lineHeight.micro,
              fontWeight: theme.fontWeight.bold,
            }}
          >
            {badge}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  round: { width: BELL_SIZE, height: BELL_SIZE, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    top: BADGE_OFFSET,
    right: BADGE_OFFSET,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderWidth: BADGE_RING,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});
