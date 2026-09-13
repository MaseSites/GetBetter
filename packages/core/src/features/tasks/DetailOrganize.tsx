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
import {
  Chip,
  Input,
  measureAnchor,
  Segmented,
  type MenuAnchor,
  type MenuEntry,
  type SegmentedOption,
} from '@/ui';

import { ChipRow, FieldRow, TokenChip } from './fields';
import { PRIORITY_MARKS } from './labels';
import { uniqueTags } from './lists';

type PriorityValue = '0' | '1' | '2' | '3';

/** Priorität als Segment, Projekt, Abschnitt und Tags. Jede Wahl gilt sofort. */
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
  const [tagDraft, setTagDraft] = useState('');

  const priority = priorityOf(task.priority);
  const project = projects.find((entry) => entry.id === task.projectId);
  const sections = project?.sections ?? [];
  const tags = task.tags ?? [];

  const options: SegmentedOption<PriorityValue>[] = TASK_PRIORITIES.map((level) => ({
    value: String(level) as PriorityValue,
    label: level === 0 ? t('tasks.priority.none') : PRIORITY_MARKS[level],
  }));

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
    <View style={{ gap: theme.spacing.md }}>
      <Segmented
        accessibilityLabel={t('tasks.field.priority')}
        options={options}
        value={String(priority) as PriorityValue}
        onChange={(value) =>
          void taskRepo.update(task.id, { priority: Number(value) as TaskPriority })
        }
      />

      <View ref={projectNode} collapsable={false}>
        <FieldRow
          separator={false}
          icon="briefcase"
          label={t('tasks.field.project')}
          value={project?.name ?? t('tasks.project.none')}
          onPress={() => void pickProject()}
        />
      </View>

      {sections.length > 0 ? (
        <ChipRow>
          <Chip
            label={t('tasks.project.noSection')}
            selected={!task.section || !sections.includes(task.section)}
            onPress={() => void taskRepo.update(task.id, { section: null })}
          />
          {sections.map((section) => (
            <Chip
              key={section}
              label={section}
              selected={task.section === section}
              onPress={() => void taskRepo.update(task.id, { section })}
            />
          ))}
        </ChipRow>
      ) : null}

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
    </View>
  );
}
