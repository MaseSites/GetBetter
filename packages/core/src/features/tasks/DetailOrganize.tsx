import { useRef, useState } from 'react';
import { View } from 'react-native';

import {
  TASK_PRIORITIES,
  tasks as taskRepo,
  type ProjectRow,
  type TaskPriority,
  type TaskRow,
} from '@/db';
import { priorityOf } from '@/db/taskFields';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Chip, Input, measureAnchor, Text, type MenuAnchor, type MenuEntry } from '@/ui';

import { ChipRow, FieldRow, TokenChip } from './fields';
import { priorityName } from './labels';
import { uniqueTags } from './lists';

type Open = 'priority' | 'section' | 'tags' | null;

/**
 * Priorität, Projekt, Abschnitt und Tags — jede als Zeile mit Namen und Wert,
 * wie bei „Wann“: ein Tipp klappt die Auswahl auf, jede Wahl gilt sofort.
 * Keine Ausrufezeichen, keine Chips ohne Ueberschrift.
 */
export function DetailOrganize({
  task,
  projects,
  openMenu,
}: {
  task: TaskRow;
  projects: readonly ProjectRow[];
  openMenu: (anchor: MenuAnchor, items: readonly MenuEntry[]) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const projectNode = useRef<View>(null);
  const [open, setOpen] = useState<Open>(null);
  const [tagDraft, setTagDraft] = useState('');

  const priority = priorityOf(task.priority);
  const project = projects.find((entry) => entry.id === task.projectId);
  const sections = project?.sections ?? [];
  const section = task.section && sections.includes(task.section) ? task.section : null;
  const tags = task.tags ?? [];
  const toggle = (key: Exclude<Open, null>) => setOpen((current) => (current === key ? null : key));

  async function pickProject() {
    const anchor = await measureAnchor(projectNode.current);
    if (!anchor) return;
    openMenu(anchor, [
      {
        key: 'none',
        label: t('tasks.project.none'),
        selected: !task.projectId,
        onPress: () => void taskRepo.update(task.id, { projectId: null, section: null }),
      },
      ...projects.map((entry) => ({
        key: entry.id,
        label: entry.name,
        selected: task.projectId === entry.id,
        onPress: () => void taskRepo.update(task.id, { projectId: entry.id, section: null }),
      })),
    ]);
  }

  function addTags() {
    const typed = tagDraft
      .split(/[\s,]+/u)
      .map((tag) => tag.replace(/^#+/u, ''))
      .filter((tag) => tag.length > 0);
    setTagDraft('');
    if (typed.length === 0) return;
    void taskRepo.update(task.id, { tags: uniqueTags([...tags, ...typed]) });
  }

  return (
    <View>
      <FieldRow
        separator={false}
        icon="flag"
        label={t('tasks.field.priority')}
        value={priorityName(t, priority)}
        expanded={open === 'priority'}
        onPress={() => toggle('priority')}
      >
        <ChipRow>
          {TASK_PRIORITIES.map((level) => (
            <Chip
              key={level}
              label={priorityName(t, level)}
              selected={priority === level}
              onPress={() => void taskRepo.update(task.id, { priority: level as TaskPriority })}
            />
          ))}
        </ChipRow>
        <Text variant="caption" tone="faint">
          {t('tasks.priority.hint')}
        </Text>
      </FieldRow>

      <View ref={projectNode} collapsable={false}>
        <FieldRow
          icon="briefcase"
          label={t('tasks.field.project')}
          value={project?.name ?? t('tasks.project.none')}
          onPress={() => void pickProject()}
        />
      </View>

      {sections.length > 0 ? (
        <FieldRow
          icon="lines"
          label={t('tasks.field.section')}
          value={section ?? t('tasks.project.noSection')}
          expanded={open === 'section'}
          onPress={() => toggle('section')}
        >
          <ChipRow>
            <Chip
              label={t('tasks.project.noSection')}
              selected={section === null}
              onPress={() => void taskRepo.update(task.id, { section: null })}
            />
            {sections.map((entry) => (
              <Chip
                key={entry}
                label={entry}
                selected={section === entry}
                onPress={() => void taskRepo.update(task.id, { section: entry })}
              />
            ))}
          </ChipRow>
        </FieldRow>
      ) : null}

      <FieldRow
        icon="tag"
        label={t('tasks.field.tags')}
        value={tags.length > 0 ? tags.map((tag) => `#${tag}`).join(' ') : t('tasks.tags.none')}
        expanded={open === 'tags'}
        onPress={() => toggle('tags')}
      >
        {tags.length > 0 ? (
          <ChipRow>
            {tags.map((tag) => (
              <TokenChip
                key={tag}
                label={`#${tag}`}
                onRemove={() =>
                  void taskRepo.update(task.id, { tags: tags.filter((entry) => entry !== tag) })
                }
              />
            ))}
          </ChipRow>
        ) : null}
        <Input
          value={tagDraft}
          onChangeText={setTagDraft}
          placeholder={t('tasks.detail.addTag')}
          accessibilityLabel={t('tasks.field.tags')}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={addTags}
        />
        <Text variant="caption" tone="faint" style={{ paddingTop: theme.spacing.xs }}>
          {t('tasks.tags.hint')}
        </Text>
      </FieldRow>
    </View>
  );
}
