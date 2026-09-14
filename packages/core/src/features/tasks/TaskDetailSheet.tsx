import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { tasks as taskRepo, type ProjectRow, type TaskRow } from '@/db';
import { formatDayMonth, useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import {
  HIT_TARGET,
  Icon,
  IconButton,
  measureAnchor,
  Sheet,
  Text,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';

import { DetailOrganize } from './DetailOrganize';
import { DetailAttachments, DetailSubtasks } from './DetailSubtasks';
import { DetailWhen } from './DetailWhen';
import { CIRCLE_SIZE } from './TaskRowItem';

/** So lange nach dem letzten Tastendruck wird Titel oder Notiz gesichert. */
const DRAFT_SAVE_MS = 500;
const CIRCLE_BORDER = 2;

/**
 * Titel und Notiz, ausserhalb von React: gesichert kurz nach dem Tippen, beim
 * Verlassen des Feldes und spaetestens, wenn das Blatt schliesst.
 */
class DraftBox {
  private title: string;
  private notes: string;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly id: string,
    private savedTitle: string,
    private savedNotes: string,
  ) {
    this.title = savedTitle;
    this.notes = savedNotes;
  }

  setTitle(title: string) {
    this.title = title;
    this.schedule();
  }

  setNotes(notes: string) {
    this.notes = notes;
    this.schedule();
  }

  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const title = this.title.trim();
    const notes = this.notes.trim();
    const titleChanged = title.length > 0 && title !== this.savedTitle.trim();
    const notesChanged = notes !== this.savedNotes.trim();
    if (!titleChanged && !notesChanged) return;
    if (titleChanged) this.savedTitle = title;
    if (notesChanged) this.savedNotes = notes;
    void taskRepo.update(this.id, {
      ...(titleChanged ? { title } : {}),
      ...(notesChanged ? { notes } : {}),
    });
  }

  private schedule() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), DRAFT_SAVE_MS);
  }
}

function Heading({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return (
    <Text variant="overline" tone="muted" style={{ paddingTop: theme.spacing.xl }}>
      {children}
    </Text>
  );
}

type BodyProps = {
  task: TaskRow;
  rows: readonly TaskRow[];
  projects: readonly ProjectRow[];
  today: string;
  accountId: string;
  onOpenSubtask: (id: string) => void;
  onToggleDone: (task: TaskRow) => void;
  openMenu: (anchor: MenuAnchor, items: readonly MenuEntry[]) => void;
};

function DetailBody({
  task,
  rows,
  projects,
  today,
  accountId,
  onOpenSubtask,
  onToggleDone,
  openMenu,
}: BodyProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const [draft] = useState(() => new DraftBox(task.id, task.title, task.notes ?? ''));
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? '');

  // Schliessen sichert: was noch nicht gesichert ist, geht beim Aushaengen hinaus.
  useEffect(() => () => draft.flush(), [draft]);

  const created = formatDayMonth(language, new Date(task.createdAt));
  const footer = [
    t('tasks.detail.created', { date: created }),
    task.completedAt
      ? t('tasks.detail.completed', { date: formatDayMonth(language, new Date(task.completedAt)) })
      : '',
  ]
    .filter((part) => part.length > 0)
    .join(' · ');

  const inputBase = { fontFamily: theme.fontFamily, color: theme.colors.text };

  return (
    <View style={{ paddingBottom: theme.spacing.xl }}>
      <View style={[styles.titleRow, { gap: theme.spacing.xs }]}>
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: task.done }}
          accessibilityLabel={t('tasks.a11y.complete', { title: task.title })}
          onPress={() => onToggleDone(task)}
          style={styles.hit}
        >
          <View
            style={[
              styles.circle,
              {
                borderRadius: theme.radii.pill,
                borderColor: task.done ? theme.colors.accentMark : theme.colors.textFaint,
                backgroundColor: task.done ? theme.colors.accent : 'transparent',
              },
            ]}
          >
            {task.done ? (
              <Icon name="check" size={theme.fontSize.sm} color={theme.colors.textOnAccent} />
            ) : null}
          </View>
        </Pressable>
        <TextInput
          value={title}
          onChangeText={(value) => {
            setTitle(value);
            draft.setTitle(value);
          }}
          onBlur={() => draft.flush()}
          multiline
          placeholder={t('tasks.detail.titlePlaceholder')}
          placeholderTextColor={theme.colors.textFaint}
          accessibilityLabel={t('tasks.detail.titlePlaceholder')}
          style={[
            styles.input,
            inputBase,
            {
              fontSize: theme.fontSize.lg,
              lineHeight: theme.lineHeight.lg,
              fontWeight: theme.fontWeight.semibold,
              paddingVertical: theme.spacing.sm,
            },
          ]}
        />
      </View>

      <Heading>{t('tasks.detail.when')}</Heading>
      <DetailWhen task={task} today={today} />

      <Heading>{t('tasks.detail.organize')}</Heading>
      <DetailOrganize task={task} projects={projects} openMenu={openMenu} />

      <Heading>{t('tasks.field.subtasks')}</Heading>
      <DetailSubtasks task={task} rows={rows} onOpen={onOpenSubtask} />

      <Heading>{t('tasks.notes')}</Heading>
      <TextInput
        value={notes}
        onChangeText={(value) => {
          setNotes(value);
          draft.setNotes(value);
        }}
        onBlur={() => draft.flush()}
        multiline
        placeholder={t('tasks.detail.notesPlaceholder')}
        placeholderTextColor={theme.colors.textFaint}
        accessibilityLabel={t('tasks.notes')}
        style={[
          styles.input,
          inputBase,
          {
            fontSize: theme.fontSize.md,
            lineHeight: theme.lineHeight.md,
            minHeight: HIT_TARGET * 2,
            paddingVertical: theme.spacing.sm,
          },
        ]}
      />

      <Heading>{t('tasks.field.attachments')}</Heading>
      <View style={{ paddingTop: theme.spacing.sm }}>
        <DetailAttachments task={task} accountId={accountId} />
      </View>

      <Text variant="caption" tone="faint" style={{ paddingTop: theme.spacing.xl }}>
        {footer}
      </Text>
    </View>
  );
}

export type TaskDetailSheetProps = {
  /** Aufgabe und darunter geoeffnete Teilaufgaben; leer heisst zu. */
  stack: readonly string[];
  rows: readonly TaskRow[];
  projects: readonly ProjectRow[];
  today: string;
  accountId: string;
  onPush: (id: string) => void;
  onPop: () => void;
  onClose: () => void;
  onToggleDone: (task: TaskRow) => void;
  onDuplicate: (task: TaskRow) => void;
  onDelete: (task: TaskRow) => void;
  openMenu: (anchor: MenuAnchor, items: readonly MenuEntry[]) => void;
};

/**
 * Das Blatt einer Aufgabe, zuerst mittelhoch. Kein „Fertig“: Schliessen
 * sichert. Eine Teilaufgabe oeffnet sich im selben Blatt eine Ebene tiefer.
 */
export function TaskDetailSheet({
  stack,
  rows,
  projects,
  today,
  accountId,
  onPush,
  onPop,
  onClose,
  onToggleDone,
  onDuplicate,
  onDelete,
  openMenu,
}: TaskDetailSheetProps) {
  const { t } = useI18n();
  const theme = useTheme();
  const moreNode = useRef<View>(null);
  const currentId = stack[stack.length - 1];
  const current = currentId ? rows.find((row) => row.id === currentId) : undefined;

  async function openMore() {
    if (!current) return;
    const anchor = await measureAnchor(moreNode.current);
    if (!anchor) return;
    openMenu(anchor, [
      {
        key: 'duplicate',
        label: t('tasks.action.duplicate'),
        icon: 'doc',
        onPress: () => onDuplicate(current),
      },
      {
        key: 'delete',
        label: t('common.delete'),
        icon: 'trash',
        destructive: true,
        onPress: () => onDelete(current),
      },
    ]);
  }

  const header = (
    <View style={[styles.header, { gap: theme.spacing.sm }]}>
      {stack.length > 1 ? (
        <IconButton icon="back" label={t('common.back')} tone="default" onPress={onPop} />
      ) : null}
      <View style={styles.grow} />
      <View ref={moreNode} collapsable={false}>
        <IconButton
          icon="more"
          label={t('tasks.more')}
          tone="default"
          onPress={() => void openMore()}
        />
      </View>
    </View>
  );

  return (
    <Sheet visible={stack.length > 0} onClose={onClose} detent="medium" header={header}>
      {current ? (
        <DetailBody
          key={current.id}
          task={current}
          rows={rows}
          projects={projects}
          today={today}
          accountId={accountId}
          onOpenSubtask={onPush}
          onToggleDone={onToggleDone}
          openMenu={openMenu}
        />
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', minHeight: HIT_TARGET },
  grow: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  hit: { width: HIT_TARGET, height: HIT_TARGET, alignItems: 'center', justifyContent: 'center' },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderWidth: CIRCLE_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: { flex: 1, outlineStyle: 'none' as never },
});
