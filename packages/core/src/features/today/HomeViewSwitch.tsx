import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslate, type TranslationKey } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, type IconName } from '@/ui';

import type { HomeView } from './homeView';

const OPTIONS: readonly { view: HomeView; icon: IconName; label: TranslationKey }[] = [
  { view: 'list', icon: 'lines', label: 'today.view.list' },
  { view: 'grid', icon: 'grid', label: 'today.view.grid' },
  { view: 'focus', icon: 'clock', label: 'today.view.focus' },
  { view: 'custom', icon: 'plus', label: 'today.view.custom' },
];

/** Ein Knopf im Umschalter — breit genug fuer den Daumen, flach genug fuer die Kopfzeile. */
const OPTION_WIDTH = 34;
const OPTION_HEIGHT = 30;
const INSET = 3;

/**
 * Vier Knoepfe fuer die vier Ansichten der Startseite: alles untereinander,
 * Kacheln, nur jetzt — und das „+“ fuer die eigene. Die gewaehlte steht als
 * Tinte, die anderen leise.
 */
export function HomeViewSwitch({
  value,
  onChange,
}: {
  value: HomeView;
  onChange: (view: HomeView) => void;
}) {
  const t = useTranslate();
  const theme = useTheme();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('today.view.label')}
      style={[
        styles.pill,
        theme.elevation.card,
        { padding: INSET, borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
      ]}
    >
      {OPTIONS.map((option) => {
        const selected = option.view === value;
        return (
          <Pressable
            key={option.view}
            accessibilityRole="tab"
            accessibilityLabel={t(option.label)}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.view)}
            hitSlop={INSET}
            style={({ pressed }) => [
              styles.option,
              {
                borderRadius: theme.radii.pill,
                // Auf der umgekehrten Flaeche steht nur `onInverse`.
                backgroundColor: selected ? theme.colors.inverse : 'transparent',
                opacity: pressed && !selected ? 0.6 : 1,
              },
            ]}
          >
            <Icon
              name={option.icon}
              size={17}
              color={selected ? theme.colors.onInverse : theme.colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignSelf: 'flex-end' },
  option: {
    width: OPTION_WIDTH,
    height: OPTION_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
