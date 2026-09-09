import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type HeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Hebt den Knopf hervor, z.B. ein gesetzter Favoritenstern. */
  active?: boolean;
};

export type HeaderProps = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  actions?: readonly HeaderAction[];
  /** Beliebiger Inhalt rechts, z.B. ein Umschalter. */
  right?: ReactNode;
  large?: boolean;
  children?: ReactNode;
};

export function Header({
  title,
  subtitle,
  showBack = false,
  onBack,
  actions = [],
  right,
  large = false,
  children,
}: HeaderProps) {
  const theme = useTheme();
  const t = useTranslate();
  const insets = useSafeAreaInsets();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/today');
    }
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg + insets.top,
          paddingBottom: theme.spacing.md,
          gap: theme.spacing.sm,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <View style={[styles.row, { gap: theme.spacing.sm, minHeight: 32 }]}>
        {showBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.back')}
            onPress={handleBack}
            hitSlop={12}
            style={styles.backButton}
          >
            <Icon name="back" size={24} color={theme.colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          {title ? (
            <Text variant={large ? 'display' : 'title'} numberOfLines={1}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text variant="label" tone="muted" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.actions, { gap: theme.spacing.sm }]}>
          {right}
          {actions.map((action) => (
            <Pressable
              key={action.label}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              onPress={action.onPress}
              hitSlop={10}
              style={({ pressed }) => [
                styles.actionButton,
                {
                  borderRadius: theme.radii.pill,
                  backgroundColor: action.active
                    ? theme.colors.accentSoft
                    : pressed
                      ? theme.colors.surfaceMuted
                      : theme.colors.surface,
                  borderColor: action.active ? theme.colors.accent : theme.colors.border,
                },
              ]}
            >
              <Icon
                name={action.icon}
                size={18}
                color={action.active ? theme.colors.accentStrong : theme.colors.text}
              />
            </Pressable>
          ))}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {},
  row: { flexDirection: 'row', alignItems: 'center' },
  backButton: { marginLeft: -6 },
  titles: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: {
    width: 34,
    height: 34,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
