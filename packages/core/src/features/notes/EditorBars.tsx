import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, Text, type IconName } from '@/ui';

import { NOTE_ICONS } from './icons';

type ToolButtonProps = {
  label: string;
  icon?: IconName;
  /** Ein Wort statt eines Symbols, etwa „Aa“. */
  text?: string;
  /** Pfeil nach oben: das Symbol nach unten, gedreht. */
  flipped?: boolean;
  onPress: () => void;
  onPressIn?: () => void;
};

function ToolButton({ label, icon, text, flipped = false, onPress, onPressIn }: ToolButtonProps) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPressIn={onPressIn}
      onPress={onPress}
      style={({ pressed }) => [
        styles.tool,
        { minWidth: HIT_TARGET, height: HIT_TARGET, opacity: pressed ? 0.5 : 1 },
      ]}
    >
      {icon ? (
        <View style={flipped ? styles.flipped : null}>
          <Icon name={icon} size={22} color={theme.colors.text} />
        </View>
      ) : (
        <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
          {text}
        </Text>
      )}
    </Pressable>
  );
}

export type EditorToolbarProps = {
  onFormat: () => void;
  onChecklist: () => void;
  /** Fehlt, wo es keine Bildauswahl gibt. */
  onImage?: () => void;
  onHideKeyboard: () => void;
  /** Beim Druecken, bevor der Fokus im Browser wandert. */
  onHold: () => void;
};

/** Die Leiste ueber der Tastatur — nur beim Schreiben: Aa · Checkliste · Bild · Tastatur schliessen. */
export function EditorToolbar({
  onFormat,
  onChecklist,
  onImage,
  onHideKeyboard,
  onHold,
}: EditorToolbarProps) {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <View
      style={[
        styles.bar,
        {
          minHeight: HIT_TARGET,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.sm,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <ToolButton
        text={t('notes.toolbar.format')}
        label={t('notes.format.title')}
        onPressIn={onHold}
        onPress={onFormat}
      />
      <ToolButton
        icon="checkbox"
        label={t('notes.kind.check')}
        onPressIn={onHold}
        onPress={onChecklist}
      />
      {onImage ? (
        <ToolButton
          icon="image"
          label={t('notes.toolbar.image')}
          onPressIn={onHold}
          onPress={onImage}
        />
      ) : null}
      <View style={styles.grow} />
      <ToolButton
        icon={NOTE_ICONS.keyboardDown}
        label={t('notes.toolbar.hideKeyboard')}
        onPressIn={onHold}
        onPress={onHideKeyboard}
      />
    </View>
  );
}

export type FindBarProps = {
  query: string;
  onChangeQuery: (query: string) => void;
  /** Die aktuelle Stelle, ab 0. */
  current: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  autoFocus: boolean;
};

/** Unten beim Suchen in der Notiz: Feld, ↑ ↓ und „2 von 5“. */
export function FindBar({
  query,
  onChangeQuery,
  current,
  total,
  onPrev,
  onNext,
  onClose,
  autoFocus,
}: FindBarProps) {
  const t = useTranslate();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const status =
    total > 0
      ? t('notes.find.position', { current: current + 1, total })
      : query.trim().length > 0
        ? t('notes.find.none')
        : null;

  return (
    <View
      style={[
        styles.bar,
        {
          minHeight: HIT_TARGET,
          paddingLeft: theme.spacing.edge,
          paddingRight: theme.spacing.sm,
          paddingBottom: insets.bottom,
          gap: theme.spacing.xs,
          borderTopColor: theme.colors.border,
          backgroundColor: theme.colors.background,
        },
      ]}
    >
      <Icon name="search" size={18} color={theme.colors.textFaint} />
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder={t('notes.action.find')}
        placeholderTextColor={theme.colors.textFaint}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        onSubmitEditing={onNext}
        accessibilityLabel={t('notes.action.find')}
        style={[
          styles.grow,
          styles.field,
          { fontFamily: theme.fontFamily, fontSize: theme.fontSize.md, color: theme.colors.text },
        ]}
      />
      {status ? (
        <Text variant="label" tone="muted">
          {status}
        </Text>
      ) : null}
      <ToolButton icon="down" flipped label={t('notes.find.prev')} onPress={onPrev} />
      <ToolButton icon="down" label={t('notes.find.next')} onPress={onNext} />
      <ToolButton icon="close" label={t('common.close')} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tool: { alignItems: 'center', justifyContent: 'center' },
  flipped: { transform: [{ rotate: '180deg' }] },
  grow: { flex: 1 },
  field: { outlineStyle: 'none' as never, padding: 0 },
});
