import { Pressable, StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import { Icon, Text } from '@/ui';

import {
  EVENT_COLORS,
  EVENT_COLOR_KEYS,
  colorLabelKey,
  type EventColorKey,
} from './colors';

/** Die sieben Terminfarben als runde Felder; die gewählte trägt einen Haken. */
export function EventColorPicker({
  value,
  onChange,
}: {
  value: EventColorKey;
  onChange: (key: EventColorKey) => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.sm }}>
      <Text variant="label" tone="muted">
        {t('calendar.field.color')}
      </Text>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        {EVENT_COLOR_KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="radio"
            accessibilityState={{ selected: value === key }}
            accessibilityLabel={t(colorLabelKey(key))}
            onPress={() => onChange(key)}
            style={[
              styles.swatch,
              {
                backgroundColor: EVENT_COLORS[key],
                borderColor: value === key ? theme.colors.text : 'transparent',
              },
            ]}
          >
            {value === key ? <Icon name="check" size={16} color="#FFFFFF" /> : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
