import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import {
  Chip,
  HIT_TARGET,
  Icon,
  Input,
  ListSeparator,
  ROW_MIN_HEIGHT,
  SectionHeader,
  Text,
  type IconName,
  type TextTone,
} from '@/ui';

import { parseClock } from './days';

/** Die Uhrzeiten, die man am haeufigsten waehlt. */
export const TIME_PRESETS: readonly string[] = ['09:00', '12:00', '18:00'];

/** Abschnittskopf mit Seitenrand — die Zeilen darunter tragen ihren eigenen. */
export function ListHeader({
  label,
  actionLabel,
  onAction,
  first = false,
  tone = 'muted',
}: {
  label: string;
  actionLabel?: string;
  onAction?: () => void;
  first?: boolean;
  /** `danger` nur für „Überfällig“. */
  tone?: 'muted' | 'danger';
}) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing.lg }}>
      <SectionHeader
        label={label}
        actionLabel={actionLabel}
        onAction={onAction}
        first={first}
        tone={tone}
      />
    </View>
  );
}

/** Ein Satz, wo nichts ist — und hoechstens ein Tipp darunter. */
export function QuietEmpty({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.empty,
        {
          paddingVertical: theme.spacing.xxl,
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.sm,
        },
      ]}
    >
      <Text variant="title" align="center">
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={onAction}
          hitSlop={theme.spacing.md}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <Text variant="body" tone="accent" align="center">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Eine Zeile mit Symbol links, Text und Wert rechts — Übersicht, Projekte, „Aufgabe hinzufügen“. */
export function ActionRow({
  icon,
  label,
  value,
  tone = 'default',
  onPress,
}: {
  icon?: IconName;
  label: string;
  value?: string;
  tone?: TextTone;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}, ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: ROW_MIN_HEIGHT.one,
          paddingLeft: theme.spacing.xs,
          paddingRight: theme.spacing.lg,
          gap: theme.spacing.sm,
          backgroundColor: pressed ? theme.colors.surfaceMuted : undefined,
        },
      ]}
    >
      <View style={styles.leading}>
        {icon ? (
          <Icon
            name={icon}
            size={20}
            color={tone === 'accent' ? theme.colors.accentStrong : theme.colors.textMuted}
          />
        ) : null}
      </View>
      <Text variant="body" tone={tone} numberOfLines={1} style={styles.grow}>
        {label}
      </Text>
      {value ? (
        <Text variant="body" tone="muted">
          {value}
        </Text>
      ) : null}
    </Pressable>
  );
}

/** Ein erkannter Teil oder ein Tag: Wort und ✕ zum Entfernen. */
export function TokenChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.accentSoft,
          paddingLeft: theme.spacing.md,
          gap: theme.spacing.xs,
        },
      ]}
    >
      <Text variant="label" numberOfLines={1} style={{ color: theme.colors.accentStrong }}>
        {label}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tasks.quick.removeChip', { label })}
        onPress={onRemove}
        hitSlop={theme.spacing.sm}
        style={({ pressed }) => ({
          padding: theme.spacing.sm,
          opacity: pressed ? 0.5 : 1,
        })}
      >
        <Icon name="close" size={14} color={theme.colors.accentStrong} />
      </Pressable>
    </View>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.chips, { gap: theme.spacing.sm }]}>{children}</View>;
}

/** Eine Zeile im Blatt: Symbol, Name, Wert. Ein Tipp klappt darunter die Auswahl auf. */
export function FieldRow({
  icon,
  label,
  value,
  valueTone = 'muted',
  expanded = false,
  onPress,
  separator = true,
  children,
}: {
  icon: IconName;
  label: string;
  value: string;
  valueTone?: TextTone;
  expanded?: boolean;
  onPress: () => void;
  separator?: boolean;
  children?: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View>
      {separator ? <ListSeparator inset={HIT_TARGET} /> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${value}`}
        accessibilityState={{ expanded }}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { minHeight: ROW_MIN_HEIGHT.one, gap: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
        ]}
      >
        <View style={styles.fieldIcon}>
          <Icon name={icon} size={18} color={theme.colors.textMuted} />
        </View>
        <Text variant="body" style={styles.grow}>
          {label}
        </Text>
        <Text variant="body" tone={valueTone} numberOfLines={1}>
          {value}
        </Text>
      </Pressable>
      {expanded && children ? (
        <View
          style={{
            paddingLeft: HIT_TARGET,
            paddingBottom: theme.spacing.md,
            gap: theme.spacing.sm,
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  );
}

/** Uhrzeit: keine, ein paar Vorschlaege, oder selbst getippt. */
export function TimeField({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (time: string | null) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [text, setText] = useState(value !== null && !TIME_PRESETS.includes(value) ? value : '');
  const [error, setError] = useState(false);

  function choose(time: string | null) {
    setText('');
    setError(false);
    onChange(time);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <ChipRow>
        <Chip label={t('tasks.time.none')} selected={value === null} onPress={() => choose(null)} />
        {TIME_PRESETS.map((time) => (
          <Chip key={time} label={time} selected={value === time} onPress={() => choose(time)} />
        ))}
      </ChipRow>
      <Input
        value={text}
        onChangeText={(input) => {
          setText(input);
          const clock = parseClock(input);
          setError(input.trim().length > 0 && clock === null);
          if (clock) onChange(clock);
        }}
        placeholder={t('tasks.time.placeholder')}
        keyboardType="numbers-and-punctuation"
        accessibilityLabel={t('tasks.field.time')}
        {...(error ? { error: t('tasks.time.error') } : {})}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  leading: { width: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  fieldIcon: { width: HIT_TARGET - 20, alignItems: 'flex-start', justifyContent: 'center' },
  grow: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
});
