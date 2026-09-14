import { useRef } from 'react';
import { Platform, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';

import type { TaskRow } from '@/db';
import { dueDayOf, priorityOf } from '@/db/taskFields';
import { useI18n } from '@/i18n';
import { useTheme, type Theme } from '@/theme';
import {
  ContextMenu,
  HIT_TARGET,
  Icon,
  LONG_PRESS_MS,
  measureAnchor,
  ROW_MIN_HEIGHT,
  SwipeRow,
  Text,
  type MenuEntry,
  type SwipeAction,
} from '@/ui';

import { metaA11y, POSTPONE_ICONS, postponeLabel, PRIORITY_MARKS, priorityPhrase } from './labels';
import { postponeKindsFor } from './postpone';
import type { ReorderBinding } from './ReorderList';
import { useTaskList, type RowMode } from './TaskListContext';
import { TaskMeta } from './TaskMeta';

/** Bauplan: der Kreis ist 22 pt gross, in einer Trefferflaeche von 44 pt. */
export const CIRCLE_SIZE = 22;
const CIRCLE_BORDER = 2;

/** Die Linien zwischen Aufgaben beginnen unter dem Titel, nicht unter dem Kreis. */
export function taskSeparatorInset(theme: Theme): number {
  return theme.spacing.xs + HIT_TARGET + theme.spacing.sm;
}

export type TaskRowItemProps = {
  task: TaskRow;
  mode: RowMode;
  /** Nur in Listen, die sich von Hand ordnen lassen. */
  reorder?: ReorderBinding;
};

/**
 * Eine Aufgabe: Kreis links, „!!“ und Titel, darunter die Metazeile, rechts
 * nichts. Wisch nach rechts erledigt, nach links Morgen · Planen · Löschen.
 */
export function TaskRowItem({ task, mode, reorder }: TaskRowItemProps) {
  const env = useTaskList();
  const { t, language } = useI18n();
  const theme = useTheme();
  const node = useRef<View>(null);

  const selecting = env.selection !== null;
  const selected = env.selection?.has(task.id) ?? false;
  const done = task.done || env.completing.has(task.id);
  const checked = selecting ? selected : done;
  const struck = done && !selecting;
  const parts = env.metaOf(task, mode);
  const priority = priorityOf(task.priority);
  const anchor = () => measureAnchor(node.current);

  const label = [
    priority > 0 ? priorityPhrase(t, priority) : '',
    task.title,
    metaA11y(t, language, env.today, parts),
  ]
    .filter((part) => part.length > 0)
    .join(', ');

  const press = () => (selecting ? env.toggleSelect(task) : env.open(task));

  // Offenes laesst sich direkt verschieben; Erledigtes behaelt „Planen …“.
  const dateItems: MenuEntry[] = task.done
    ? [
        {
          key: 'plan',
          label: t('tasks.action.planMore'),
          icon: 'calendar',
          onPress: () => env.plan([task], anchor),
        },
      ]
    : [
        { key: 'postponeStart', divider: true },
        ...postponeKindsFor(dueDayOf(task), env.today).map((kind): MenuEntry => ({
          key: `postpone-${kind}`,
          label: postponeLabel(t, kind),
          icon: POSTPONE_ICONS[kind],
          onPress: () => env.postpone(task, kind),
        })),
        {
          key: 'pick',
          label: t('tasks.plan.pick'),
          icon: 'more',
          onPress: () => env.pickDate([task]),
        },
        { key: 'postponeEnd', divider: true },
      ];

  const items: MenuEntry[] = selecting
    ? []
    : [
        {
          key: 'done',
          label: task.done ? t('tasks.action.reopen') : t('tasks.action.done'),
          icon: 'check',
          onPress: () => env.toggleDone(task),
        },
        ...dateItems,
        {
          key: 'priority',
          label: t('tasks.action.priorityMore'),
          icon: 'flag',
          onPress: () => env.prioritize([task], anchor),
        },
        {
          key: 'move',
          label: t('tasks.action.moveMore'),
          icon: 'briefcase',
          onPress: () => env.move([task], anchor),
        },
        {
          key: 'duplicate',
          label: t('tasks.action.duplicate'),
          icon: 'doc',
          onPress: () => env.duplicate(task),
        },
        {
          key: 'select',
          label: t('tasks.action.select'),
          icon: 'checkbox',
          onPress: () => env.startSelection(task),
        },
        {
          key: 'delete',
          label: t('common.delete'),
          icon: 'trash',
          destructive: true,
          onPress: () => env.remove(task),
        },
      ];

  const deleteAction: SwipeAction = {
    key: 'delete',
    label: t('common.delete'),
    icon: 'trash',
    tone: 'danger',
    onPress: () => env.remove(task),
  };
  const leading: SwipeAction = task.done
    ? {
        key: 'reopen',
        label: t('tasks.action.reopen'),
        icon: 'refresh',
        tone: 'accent',
        onPress: () => env.toggleDone(task),
      }
    : {
        key: 'complete',
        label: t('tasks.action.done'),
        icon: 'check',
        tone: 'accent',
        onPress: () => env.completeNow(task),
      };
  const planAction: SwipeAction = {
    key: 'plan',
    label: t('tasks.action.plan'),
    icon: 'calendar',
    tone: 'default',
    onPress: () => env.plan([task], anchor),
  };
  const tomorrowAction: SwipeAction = {
    key: 'postponeTomorrow',
    label: postponeLabel(t, 'tomorrow'),
    icon: POSTPONE_ICONS.tomorrow,
    tone: 'accent',
    onPress: () => env.postpone(task, 'tomorrow'),
  };
  const trailing = task.done
    ? [planAction, deleteAction]
    : [tomorrowAction, planAction, deleteAction];

  function handleLongPress(event: GestureResponderEvent) {
    if (!reorder || selecting) return;
    reorder.controller.arm(reorder.index, {
      x: event.nativeEvent.pageX,
      y: event.nativeEvent.pageY,
    });
  }

  function handlePressOut() {
    if (!reorder) return;
    const point = reorder.controller.releaseArm(reorder.index);
    if (!point) return;
    // Auf Android beginnt ein langer Druck die Auswahl, sonst kommt das Menue.
    if (Platform.OS === 'android') {
      env.startSelection(task);
      return;
    }
    env.openMenu({ x: point.x, y: point.y, width: 0, height: 0 }, items);
  }

  const circle = (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={
        selecting
          ? t('tasks.a11y.select', { title: task.title })
          : t('tasks.a11y.complete', { title: task.title })
      }
      onPress={() => (selecting ? env.toggleSelect(task) : env.toggleDone(task))}
      style={styles.hit}
    >
      <View
        style={[
          styles.circle,
          {
            borderRadius: theme.radii.pill,
            borderColor: checked ? theme.colors.accentMark : theme.colors.textFaint,
            backgroundColor: checked ? theme.colors.accent : 'transparent',
          },
        ]}
      >
        {checked ? (
          <Icon name="check" size={theme.fontSize.sm} color={theme.colors.textOnAccent} />
        ) : null}
      </View>
    </Pressable>
  );

  const textTone = struck ? 'faint' : 'default';
  const textBlock = (
    <>
      <Text
        variant="body"
        tone={textTone}
        numberOfLines={2}
        style={struck ? styles.struck : undefined}
      >
        {priority > 0 ? (
          <Text variant="body" tone={textTone} style={{ fontWeight: theme.fontWeight.semibold }}>
            {`${PRIORITY_MARKS[priority]} `}
          </Text>
        ) : null}
        {task.title}
      </Text>
      {parts.length > 0 ? <TaskMeta parts={parts} today={env.today} /> : null}
    </>
  );

  const textStyle = [
    styles.text,
    { paddingVertical: theme.spacing.sm, paddingRight: theme.spacing.lg },
  ];

  const content = reorder ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityActions={[
        { name: 'longpress', label: t('ui.menu.more') },
        { name: 'moveUp', label: t('tasks.action.moveUp') },
        { name: 'moveDown', label: t('tasks.action.moveDown') },
      ]}
      onAccessibilityAction={(event) => {
        const name = event.nativeEvent.actionName;
        if (name === 'moveUp') reorder.moveBy(-1);
        if (name === 'moveDown') reorder.moveBy(1);
        if (name === 'longpress') {
          void anchor().then((found) => {
            if (found) env.openMenu(found, items);
          });
        }
      }}
      onPress={press}
      onLongPress={handleLongPress}
      onPressOut={handlePressOut}
      delayLongPress={LONG_PRESS_MS}
      style={textStyle}
    >
      {textBlock}
    </Pressable>
  ) : (
    <ContextMenu
      items={items}
      onPress={press}
      onSelectMode={selecting ? undefined : () => env.startSelection(task)}
      accessibilityLabel={label}
      style={textStyle}
    >
      {textBlock}
    </ContextMenu>
  );

  return (
    <View ref={node} collapsable={false}>
      <SwipeRow
        backgroundColor={reorder?.lifted ? theme.colors.surface : theme.colors.background}
        {...(selecting ? {} : { leading, trailing, trailingFull: deleteAction })}
      >
        <View
          style={[
            styles.row,
            {
              paddingLeft: theme.spacing.xs,
              gap: theme.spacing.sm,
              minHeight: parts.length > 0 ? ROW_MIN_HEIGHT.two : ROW_MIN_HEIGHT.one,
            },
          ]}
        >
          {circle}
          {content}
        </View>
      </SwipeRow>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  hit: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderWidth: CIRCLE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, alignSelf: 'stretch', justifyContent: 'center', gap: 2 },
  struck: { textDecorationLine: 'line-through' },
});
