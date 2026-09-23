import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { currentApp } from '@/app/identity';
import { AvatarPicker } from '@/features/avatar/AvatarPicker';
import type { AvatarStyle } from '@/features/avatar/style';
import { PLAN_PRICES_CHF } from '@/features/plan/prices';
import { formatPrice, useI18n, useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Icon, Input, Text } from '@/ui';

import { StylePicker } from './StylePicker';

type FieldStepProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

/** Der Spitzname: ein Feld, sonst nichts — vorbelegt mit dem Vorschlag aus dem Benutzernamen. */
export function NameStep({ value, onChange, onSubmit }: FieldStepProps) {
  const t = useTranslate();
  return (
    <Input
      placeholder={t('intro.setup.name.placeholder')}
      value={value}
      onChangeText={onChange}
      icon="person"
      autoCapitalize="words"
      returnKeyType="next"
      onSubmitEditing={onSubmit}
    />
  );
}

/** Sein Name: ein Feld und drei Ideen zum Antippen. */
export function AssistantNameStep({ value, onChange, onSubmit }: FieldStepProps) {
  const t = useTranslate();
  const theme = useTheme();
  const ideas = t('intro.setup.assistant.ideas')
    .split(',')
    .map((idea) => idea.trim())
    .filter(Boolean);

  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Input
        placeholder={t('intro.setup.assistant.placeholder')}
        value={value}
        onChangeText={onChange}
        icon="sparkles"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={onSubmit}
      />
      <View style={[styles.chips, { gap: theme.spacing.sm }]}>
        {ideas.map((idea) => (
          <Chip
            key={idea}
            label={idea}
            selected={value.trim() === idea}
            onPress={() => onChange(idea)}
          />
        ))}
      </View>
    </View>
  );
}

export type PersonalizeStepProps = {
  assistantName: string;
  onAssistantName: (name: string) => void;
  avatar: AvatarStyle;
  onAvatar: (style: AvatarStyle) => void;
  /** Ohne Abo: oben das Angebot, ein Tipp oeffnet das Abo. */
  offer: (() => void) | null;
};

/**
 * App und Assistent auf einer Seite: oben (ohne Abo) das Angebot, darunter das
 * Aussehen der App und dann sein Name und Avatar. Alles wirkt sofort — ohne
 * Abo als Anprobe, die nichts speichert.
 */
export function PersonalizeStep({
  assistantName,
  onAssistantName,
  avatar,
  onAvatar,
  offer,
}: PersonalizeStepProps) {
  const t = useTranslate();
  const theme = useTheme();

  return (
    <View style={{ gap: theme.spacing.xl }}>
      {offer ? <PlanOffer onPress={offer} /> : null}
      <Group title={t('intro.setup.group.app')}>
        <StylePicker />
      </Group>
      <Group title={t('intro.setup.group.assistant')}>
        <AssistantNameStep
          value={assistantName}
          onChange={onAssistantName}
          onSubmit={() => undefined}
        />
        <AvatarPicker compact value={avatar} onChange={onAvatar} />
      </Group>
    </View>
  );
}

/** Eine Ueberschrift ueber einem Teil der Seite. */
function Group({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <Text variant="title">{title}</Text>
      {children}
    </View>
  );
}

/** „Alles freischalten · CHF 1.– im Monat“ — ein Tipp oeffnet das Abo. */
function PlanOffer({ onPress }: { onPress: () => void }) {
  const t = useTranslate();
  const { language } = useI18n();
  const theme = useTheme();
  const price = PLAN_PRICES_CHF[currentApp().id];
  const label = t('intro.setup.offer.title');
  const detail =
    price === null ? null : t('intro.setup.offer.price', { price: formatPrice(language, price) });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.offer,
        {
          gap: theme.spacing.md,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          borderColor: theme.colors.accentMark,
          backgroundColor: theme.colors.surface,
          transform: [{ scale: pressed ? theme.motion.pressScale.row : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          { borderRadius: theme.radii.pill, backgroundColor: theme.colors.accent },
        ]}
      >
        <Icon name="sparkles" size={theme.fontSize.lg} color={theme.colors.textOnAccent} />
      </View>
      <View style={styles.grow}>
        <Text variant="label">{label}</Text>
        {detail ? (
          <Text variant="caption" tone="accent">
            {detail}
          </Text>
        ) : null}
      </View>
      <Icon name="forward" size={theme.fontSize.md} color={theme.colors.textFaint} />
    </Pressable>
  );
}

const BADGE = 40;

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap' },
  offer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5 },
  badge: { width: BADGE, height: BADGE, alignItems: 'center', justifyContent: 'center' },
  grow: { flex: 1, gap: 2 },
});
