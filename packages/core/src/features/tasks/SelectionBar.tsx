import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { HIT_TARGET, Icon, IconButton, measureAnchor, Text, type IconName } from '@/ui';

import type { AnchorFn } from './TaskListContext';

/** Ein Knopf der Leiste: Symbol und Wort untereinander, mit eigenem Anker fuers Menue. */
function BarButton({
  icon,
  label,
  danger = false,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  danger?: boolean;
  disabled: boolean;
  onPress: (anchor: AnchorFn) => void;
}) {
  const theme = useTheme();
  const node = useRef<View>(null);
  const color = disabled
    ? theme.colors.disabledText
    : danger
      ? theme.colors.danger
      : theme.colors.text;
  return (
    <View ref={node} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => onPress(() => measureAnchor(node.current))}
        style={({ pressed }) => [
          styles.button,
          {
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.sm,
            opacity: pressed ? 0.5 : 1,
          },
        ]}
      >
        <Icon name={icon} size={20} color={color} />
        <Text variant="caption" numberOfLines={1} style={{ color }}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

export type SelectionBarProps = {
  count: number;
  onClose: () => void;
  onDone: () => void;
  onPlan: (anchor: AnchorFn) => void;
  onMove: (anchor: AnchorFn) => void;
  onDelete: () => void;
};

/** Im Auswahlmodus unten: Erledigt · Planen · Verschieben · Löschen. */
export function SelectionBar({
  count,
  onClose,
  onDone,
  onPlan,
  onMove,
  onDelete,
}: SelectionBarProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const none = count === 0;
  return (
    <View style={[styles.bar, { gap: theme.spacing.sm }]}>
      <IconButton
        icon="close"
        label={t('tasks.selection.close')}
        tone="default"
        onPress={onClose}
      />
      <Text variant="label" numberOfLines={1} style={styles.grow}>
        {t('tasks.selection.count', { count })}
      </Text>
      <BarButton icon="check" label={t('tasks.action.done')} disabled={none} onPress={onDone} />
      <BarButton icon="calendar" label={t('tasks.action.plan')} disabled={none} onPress={onPlan} />
      <BarButton icon="briefcase" label={t('tasks.action.move')} disabled={none} onPress={onMove} />
      <BarButton
        icon="trash"
        label={t('common.delete')}
        danger
        disabled={none}
        onPress={onDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  button: {
    minWidth: HIT_TARGET,
    minHeight: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
