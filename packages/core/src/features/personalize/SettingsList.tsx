import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';
import { Avatar, Button, Icon, Text, usePressScale, type IconName } from '@/ui';

/**
 * Die Bausteine der Einstellungen: eine Ueberschrift, darunter eine Karte mit
 * Zeilen, darunter ein leiser Hinweis. Profil und Einstellungen teilen sie
 * sich, damit beide gleich aussehen.
 */
export function SettingsGroup({
  title,
  /** Steht als Fussnote unter dem Inhalt — dort, wo er sich erklaert. */
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="section" style={[styles.groupTitle, { letterSpacing: theme.tracking.tag }]}>
        {title}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" tone="faint" style={styles.groupHint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Die Karte ganz oben: wer du bist. Der kleine Knopf fuehrt dorthin, wo man
 * den Namen aendert — die Karte selbst ist nicht drueckbar, sonst waere es ein
 * Knopf im Knopf.
 */
export function SettingsProfile({
  name,
  handle,
  email,
  actionLabel,
  onAction,
}: {
  name: string;
  handle: string;
  email: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.list,
        theme.elevation.card,
        {
          backgroundColor: theme.colors.surface,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.md,
        },
      ]}
    >
      <Avatar name={name} size={56} />
      <View style={[styles.grow, { gap: theme.spacing.xs }]}>
        <Text variant="label" numberOfLines={1} style={{ fontSize: theme.fontSize.lede }}>
          {name}
        </Text>
        <Text variant="caption" tone="faint" numberOfLines={1}>
          {`${handle} · ${email}`}
        </Text>
        <View style={styles.action}>
          <Button label={actionLabel} size="sm" variant="ghost" fullWidth={false} onPress={onAction} />
        </View>
      </View>
    </View>
  );
}

/** Eine Karte, in der Zeilen durch Haarlinien getrennt stehen. */
export function SettingsList({ children }: { children: ReactNode }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.list,
        theme.elevation.card,
        { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
      ]}
    >
      {children}
    </View>
  );
}

export function SettingsRow({
  label,
  value,
  icon,
  first = false,
  chevron = false,
  muted = false,
  danger = false,
  trailing,
  selected,
  onPress,
}: {
  label: string;
  value?: string;
  /** Das Zeichen links — gibt der Zeile ihr Thema auf einen Blick. */
  icon?: IconName;
  first?: boolean;
  chevron?: boolean;
  /** Leiser Titel — fuer Zeilen, die etwas anbieten statt etwas zeigen. */
  muted?: boolean;
  /** Rot: etwas, das man nicht aus Versehen tut — Abmelden, Loeschen. */
  danger?: boolean;
  /** Statt eines Werts etwas Eigenes rechts, etwa ein Farbpunkt. */
  trailing?: ReactNode;
  /** Fuer Auswahllisten: zeigt den Haken. */
  selected?: boolean;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.row);
  const tint = danger ? theme.colors.danger : theme.colors.textMuted;

  const body = (
    <Animated.View
      style={[
        styles.row,
        {
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.md,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          transform: onPress ? [{ scale: press.scale }] : [],
        },
      ]}
    >
      {icon ? <Icon name={icon} size={19} color={tint} /> : null}
      <Text
        variant="label"
        numberOfLines={1}
        style={[
          styles.grow,
          {
            fontSize: theme.fontSize.md,
            ...(danger ? { color: theme.colors.danger } : {}),
            ...(muted && !danger ? { color: theme.colors.textMuted } : {}),
          },
        ]}
      >
        {label}
      </Text>
      {value ? (
        <Text
          variant="label"
          tone="muted"
          numberOfLines={1}
          style={[styles.value, { fontSize: theme.fontSize.lede }]}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {selected ? <Icon name="check" size={18} color={theme.colors.accentStrong} /> : null}
      {chevron ? <Icon name="forward" size={15} color={theme.colors.borderStrong} /> : null}
    </Animated.View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      accessibilityRole={selected === undefined ? 'button' : 'radio'}
      accessibilityState={selected === undefined ? undefined : { selected }}
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  // Eine lange E-Mail darf schrumpfen, aber nicht den Titel verdraengen.
  value: { flexShrink: 1, textAlign: 'right' },
  groupTitle: { textTransform: 'uppercase', paddingHorizontal: 2 },
  groupHint: { paddingHorizontal: 2 },
  list: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 50 },
  // Der Knopf soll so breit sein wie sein Text, nicht wie die Karte.
  action: { alignSelf: 'flex-start' },
});
