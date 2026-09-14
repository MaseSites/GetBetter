import type { ReactNode } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ClubAvatar } from '@/features/intro/ClubAvatar';
import { useTranslate } from '@/i18n';
import { readableOn, useTheme } from '@/theme';
import { Icon, Text, usePressScale } from '@/ui';

import {
  ACCESSORIES_OF,
  AVATAR_COLORS,
  AVATAR_EYES,
  AVATAR_KINDS,
  withAvatarChange,
  type AvatarStyle,
} from './style';
import { avatarBody } from './tones';

export type AvatarChooserProps = {
  value: AvatarStyle;
  onChange: (next: AvatarStyle) => void;
};

/** So gross steht jede Figur in ihrer Kachel. */
const KIND_PREVIEW = 56;
/** Ein Farbkreis, und wie weit der Ring um den gewaehlten absteht. */
const SWATCH = 30;
const RING = 2;
const RING_GAP = 2;
const CHECK = 16;
const MONO_DIM = 0.4;

/** Die Vorlesefassung: gewaehlt steht dabei, nicht nur als Zustand. */
function useSayChosen() {
  const t = useTranslate();
  return (label: string, selected: boolean) => (selected ? t('avatar.selected', { label }) : label);
}

/** Die Figuren nebeneinander, jede als kleiner Avatar in den aktuellen Farben. */
export function AvatarKindChooser({ value, onChange }: AvatarChooserProps) {
  const t = useTranslate();
  const theme = useTheme();
  const say = useSayChosen();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="radiogroup"
      accessibilityLabel={t('avatar.kind')}
      contentContainerStyle={{ gap: theme.spacing.sm, paddingVertical: theme.spacing.xs }}
    >
      {AVATAR_KINDS.map((kind) => {
        const selected = value.kind === kind;
        const name = t(`avatar.kind.${kind}`);
        const look = withAvatarChange(value, { kind });
        return (
          <OptionTile
            key={kind}
            selected={selected}
            label={say(name, selected)}
            onPress={() => onChange(look)}
          >
            <ClubAvatar size={KIND_PREVIEW} phase="idle" still style={look} />
            <Text
              variant="caption"
              tone={selected ? 'default' : 'muted'}
              numberOfLines={1}
              style={selected ? { fontWeight: theme.fontWeight.semibold } : undefined}
            >
              {name}
            </Text>
          </OptionTile>
        );
      })}
    </ScrollView>
  );
}

/** Die acht Farben als Kreise, genau so, wie der Koerper sie zeigt. */
export function AvatarColorChooser({ value, onChange }: AvatarChooserProps) {
  const t = useTranslate();
  const theme = useTheme();
  const say = useSayChosen();
  const mono = theme.preset === 'mono';

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('avatar.color')}
      style={[styles.swatches, { rowGap: theme.spacing.sm, opacity: mono ? MONO_DIM : 1 }]}
    >
      {AVATAR_COLORS.map((color) => {
        const selected = value.color === color;
        const label = t('avatar.color.a11y', { color: t(`avatar.color.${color}`) });
        return (
          <Swatch
            key={color}
            fill={avatarBody(theme, color)}
            followsApp={color === 'accent'}
            selected={selected}
            label={say(label, selected)}
            onPress={() => onChange(withAvatarChange(value, { color }))}
          />
        );
      })}
    </View>
  );
}

export function AvatarEyesChooser({ value, onChange }: AvatarChooserProps) {
  const t = useTranslate();
  const theme = useTheme();
  const say = useSayChosen();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('avatar.eyes')}
      style={[styles.pills, { gap: theme.spacing.sm }]}
    >
      {AVATAR_EYES.map((eyes) => {
        const selected = value.eyes === eyes;
        const text = t(`avatar.eyes.${eyes}`);
        return (
          <Pill
            key={eyes}
            text={text}
            selected={selected}
            label={say(t('avatar.eyes.a11y', { eyes: text }), selected)}
            onPress={() => onChange(withAvatarChange(value, { eyes }))}
          />
        );
      })}
    </View>
  );
}

/** Nur, was die gewaehlte Figur tragen kann. */
export function AvatarAccessoryChooser({ value, onChange }: AvatarChooserProps) {
  const t = useTranslate();
  const theme = useTheme();
  const say = useSayChosen();

  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={t('avatar.accessory')}
      style={[styles.pills, { gap: theme.spacing.sm }]}
    >
      {ACCESSORIES_OF[value.kind].map((accessory) => {
        const selected = value.accessory === accessory;
        const text = t(`avatar.accessory.${accessory}`);
        return (
          <Pill
            key={accessory}
            text={text}
            selected={selected}
            label={say(t('avatar.accessory.a11y', { accessory: text }), selected)}
            onPress={() => onChange(withAvatarChange(value, { accessory }))}
          />
        );
      })}
    </View>
  );
}

type OptionProps = {
  selected: boolean;
  label: string;
  onPress: () => void;
};

/** Eine Kachel mit Ring: gewaehlt heisst ein Rand in Schriftfarbe, nicht bloss eine andere Farbe. */
function OptionTile({ selected, label, onPress, children }: OptionProps & { children: ReactNode }) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.button);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.tile,
          {
            gap: theme.spacing.xs,
            padding: theme.spacing.sm,
            borderRadius: theme.radii.md,
            borderColor: selected ? theme.colors.text : theme.colors.border,
            backgroundColor: selected ? theme.colors.surface : theme.colors.surfaceMuted,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}

function Swatch({
  fill,
  followsApp,
  selected,
  label,
  onPress,
}: OptionProps & { fill: string; followsApp: boolean }) {
  const theme = useTheme();
  const press = usePressScale(theme.motion.pressScale.button);
  const mark = readableOn(fill);

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.ring,
          {
            borderRadius: theme.radii.pill,
            borderColor: selected ? theme.colors.text : 'transparent',
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <View style={[styles.swatch, { borderRadius: theme.radii.pill, backgroundColor: fill }]}>
          {/* Gewaehlt traegt einen Haken; »wie die App« erkennt man am Funkeln. */}
          {selected ? (
            <Icon name="check" size={CHECK} color={mark} />
          ) : followsApp ? (
            <Icon name="sparkles" size={CHECK - 2} color={mark} />
          ) : null}
        </View>
      </Animated.View>
    </Pressable>
  );
}

/** Wie ein Chip: gewaehlt ist Tinte mit heller Schrift. */
function Pill({ text, selected, label, onPress }: OptionProps & { text: string }) {
  const theme = useTheme();
  const press = usePressScale();

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View
        style={[
          styles.pill,
          {
            borderRadius: theme.radii.pill,
            paddingHorizontal: theme.spacing.md,
            borderColor: selected ? theme.colors.inverse : theme.colors.border,
            backgroundColor: selected ? theme.colors.inverse : theme.colors.surface,
            transform: [{ scale: press.scale }],
          },
        ]}
      >
        <Text
          variant="label"
          style={{
            color: selected ? theme.colors.onInverse : theme.colors.textMuted,
            fontWeight: theme.fontWeight.medium,
          }}
        >
          {text}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: { alignItems: 'center', borderWidth: RING, minWidth: KIND_PREVIEW + 16 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  ring: { borderWidth: RING, padding: RING_GAP },
  swatch: { width: SWATCH, height: SWATCH, alignItems: 'center', justifyContent: 'center' },
  pills: { flexDirection: 'row', flexWrap: 'wrap' },
  pill: { minHeight: 36, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
