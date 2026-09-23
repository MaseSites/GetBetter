import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { TASK_PRIORITIES, type ProjectRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import {
  Chip,
  HIT_TARGET,
  Icon,
  IconButton,
  measureAnchor,
  Text,
  type IconName,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';

import type { DateRequest } from './DateSheet';
import { ChipRow, TokenChip } from './fields';
import {
  dayLabel,
  PRESET_ICONS,
  presetLabel,
  priorityName,
  priorityPhrase,
  reminderLabel,
  repeatLabel,
} from './labels';
import { chipsOf, parseTaskInput, type ParsedChip } from './parse';
import {
  draftOf,
  replaceLastWord,
  suggestionsFor,
  tokenOf,
  type QuickAddDefaults,
  type QuickAddManual,
  type TaskDraft,
} from './quickAdd';
import { dayBeforeOffset, REMINDER_OFFSETS, SCHEDULE_PRESETS, scheduleFor } from './schedule';
import type { AnchorFn } from './TaskListContext';

/** Das Zeichen des Tag-Knopfs — ein Satzzeichen, kein Wort. */
const TAG_MARK = '#';

/**
 * Ein Knopf unter dem Feld: Zeichen und Wort — „Datum“, „Priorität“ … Sobald
 * etwas gewaehlt ist, steht das Gewaehlte drin („Morgen 18:00“, „Hoch“).
 */
function FieldButton({
  icon,
  glyph,
  label,
  value,
  disabled = false,
  onPress,
}: {
  icon?: IconName;
  glyph?: string;
  /** Der Name des Feldes — und was die Vorlesefunktion sagt. */
  label: string;
  /** Das Gewaehlte, wenn es etwas gibt; dann ist der Knopf im Akzent. */
  value?: string | null;
  disabled?: boolean;
  onPress: (anchor: AnchorFn) => void;
}) {
  const theme = useTheme();
  const node = useRef<View>(null);
  const active = Boolean(value);
  const color = disabled
    ? theme.colors.disabledText
    : active
      ? theme.colors.accentStrong
      : theme.colors.textMuted;
  return (
    <View ref={node} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}: ${value}` : label}
        accessibilityState={{ disabled, selected: active }}
        disabled={disabled}
        onPress={() => onPress(() => measureAnchor(node.current))}
        style={({ pressed }) => [
          styles.accessory,
          {
            gap: theme.spacing.xs,
            paddingHorizontal: theme.spacing.md,
            borderRadius: theme.radii.pill,
            borderWidth: 1,
            borderColor: active ? 'transparent' : theme.colors.border,
            backgroundColor: active ? theme.colors.accentSoft : theme.colors.surface,
            opacity: pressed ? 0.5 : 1,
          },
        ]}
      >
        {icon ? (
          <Icon name={icon} size={16} color={color} />
        ) : (
          <Text variant="label" style={{ color, fontWeight: theme.fontWeight.semibold }}>
            {glyph}
          </Text>
        )}
        <Text variant="label" numberOfLines={1} style={{ color }}>
          {value ?? label}
        </Text>
      </Pressable>
    </View>
  );
}

export type QuickAddBarProps = {
  defaults: QuickAddDefaults;
  today: string;
  projects: readonly ProjectRow[];
  tags: readonly string[];
  onSubmit: (draft: TaskDraft) => void;
  onClose: () => void;
  openMenu: (anchor: MenuAnchor, items: readonly MenuEntry[]) => void;
  openDate: (request: Omit<DateRequest, 'id'>) => void;
};

/**
 * Die Schnelleingabe ueber der Tastatur: ein Satz, darunter die erkannten
 * Teile als Chips, darunter Knoepfe mit Wort — Datum · Priorität · Projekt ·
 * Tag · Erinnerung —, in denen das Gewaehlte steht, sobald es etwas gibt.
 * Die Eingabetaste sichert, die Leiste bleibt offen.
 */
export function QuickAddBar({
  defaults,
  today,
  projects,
  tags,
  onSubmit,
  onClose,
  openMenu,
  openDate,
}: QuickAddBarProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const [text, setText] = useState('');
  const [ignored, setIgnored] = useState<ReadonlySet<string>>(new Set());
  const [manual, setManual] = useState<QuickAddManual>({});

  const projectNames = projects.map((project) => project.name);
  const parsed = parseTaskInput(text, { today, projects: projectNames, ignored });
  const draft = draftOf(parsed, manual, defaults, projects, today);
  const suggestions = suggestionsFor(text, tags, projectNames);

  const overridden = {
    when: manual.day !== undefined || manual.time !== undefined,
    priority: manual.priority !== undefined,
    project: manual.projectId !== undefined,
  };
  const parsedChips = chipsOf(parsed).filter(
    (chip) =>
      !(chip.kind === 'when' && overridden.when) &&
      !(chip.kind === 'priority' && overridden.priority) &&
      !(chip.kind === 'project' && overridden.project),
  );

  function focus() {
    input.current?.focus();
  }

  function patchManual(patch: QuickAddManual) {
    setManual((current) => ({ ...current, ...patch }));
    focus();
  }

  function submit() {
    if (draft.title.length === 0) return;
    onSubmit(draft);
    setText('');
    setIgnored(new Set());
    setManual({});
    focus();
  }

  const whenText = (day: string | null, time: string | null) =>
    [day ? dayLabel(t, language, day, today) : t('tasks.plan.none'), time]
      .filter((part): part is string => Boolean(part))
      .join(', ');

  function chipLabel(chip: ParsedChip): string {
    switch (chip.kind) {
      case 'when':
        return whenText(parsed.day ?? draft.day, parsed.time);
      case 'repeat':
        return parsed.repeat ? repeatLabel(t, language, parsed.repeat) : '';
      case 'priority':
        return priorityPhrase(t, parsed.priority);
      case 'project':
        return parsed.project ?? '';
      case 'tag':
        return `#${chip.tag ?? ''}`;
    }
  }

  const draftProject = projects.find((project) => project.id === draft.projectId);

  function openDateMenu(anchor: AnchorFn) {
    void anchor().then((found) => {
      if (!found) return;
      openMenu(found, [
        ...SCHEDULE_PRESETS.map((preset) => ({
          key: preset,
          label: presetLabel(t, preset),
          icon: PRESET_ICONS[preset],
          onPress: () => {
            const schedule = scheduleFor(preset, today, draft.time);
            patchManual({ day: schedule.day, time: schedule.time });
          },
        })),
        {
          key: 'pick',
          label: t('tasks.plan.pick'),
          icon: 'calendar',
          onPress: () =>
            openDate({
              day: draft.day,
              time: draft.time,
              onApply: (schedule) => patchManual({ day: schedule.day, time: schedule.time }),
            }),
        },
      ]);
    });
  }

  function openPriorityMenu(anchor: AnchorFn) {
    void anchor().then((found) => {
      if (!found) return;
      openMenu(
        found,
        TASK_PRIORITIES.map((priority) => ({
          key: `priority-${priority}`,
          label: priorityName(t, priority),
          selected: draft.priority === priority,
          onPress: () => patchManual({ priority }),
        })),
      );
    });
  }

  function openProjectMenu(anchor: AnchorFn) {
    void anchor().then((found) => {
      if (!found) return;
      openMenu(found, [
        {
          key: 'none',
          label: t('tasks.project.none'),
          selected: draft.projectId === null,
          onPress: () => patchManual({ projectId: null }),
        },
        ...projects.map((project) => ({
          key: project.id,
          label: project.name,
          selected: draft.projectId === project.id,
          onPress: () => patchManual({ projectId: project.id }),
        })),
      ]);
    });
  }

  function openReminderMenu(anchor: AnchorFn) {
    const time = draft.time;
    if (time === null) return;
    const offsets: (number | null)[] = [null, ...REMINDER_OFFSETS, dayBeforeOffset(time)];
    void anchor().then((found) => {
      if (!found) return;
      openMenu(
        found,
        offsets.map((minutes) => ({
          key: `reminder-${String(minutes)}`,
          label: reminderLabel(t, minutes, time),
          selected: draft.reminderOffsetMinutes === minutes,
          onPress: () => patchManual({ reminder: minutes }),
        })),
      );
    });
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      {suggestions.length > 0 ? (
        <ChipRow>
          {suggestions.map((suggestion) => (
            <Chip
              key={`${suggestion.kind}-${suggestion.value}`}
              label={tokenOf(suggestion)}
              onPress={() => {
                setText((current) => replaceLastWord(current, tokenOf(suggestion)));
                focus();
              }}
            />
          ))}
        </ChipRow>
      ) : null}

      <View
        style={[
          styles.field,
          {
            borderRadius: theme.radii.sm,
            borderColor: theme.colors.text,
            backgroundColor: theme.colors.surface,
            paddingLeft: theme.spacing.md,
            gap: theme.spacing.sm,
          },
        ]}
      >
        <TextInput
          ref={input}
          value={text}
          onChangeText={setText}
          autoFocus
          placeholder={t('tasks.placeholder')}
          placeholderTextColor={theme.colors.textFaint}
          accessibilityLabel={t('tasks.new')}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={submit}
          style={[
            styles.input,
            { fontFamily: theme.fontFamily, fontSize: theme.fontSize.md, color: theme.colors.text },
          ]}
        />
        <IconButton icon="send" label={t('tasks.add')} tone="accent" onPress={submit} />
      </View>

      {parsedChips.length > 0 ? (
        <ChipRow>
          {parsedChips.map((chip) => (
            <TokenChip
              key={chip.id}
              label={chipLabel(chip)}
              onRemove={() => setIgnored((current) => new Set([...current, ...chip.keys]))}
            />
          ))}
        </ChipRow>
      ) : null}

      {text.length === 0 && parsedChips.length === 0 ? (
        <Text variant="caption" tone="faint">
          {t('tasks.quick.hint')}
        </Text>
      ) : null}

      <View style={[styles.accessories, { gap: theme.spacing.sm }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={{ gap: theme.spacing.xs }}
          style={styles.grow}
        >
          <FieldButton
            icon="calendar"
            label={t('tasks.field.date')}
            value={draft.day ? whenText(draft.day, draft.time) : null}
            onPress={openDateMenu}
          />
          <FieldButton
            icon="flag"
            label={t('tasks.field.priority')}
            value={draft.priority > 0 ? priorityName(t, draft.priority) : null}
            onPress={openPriorityMenu}
          />
          <FieldButton
            icon="briefcase"
            label={t('tasks.field.project')}
            value={draftProject?.name ?? null}
            onPress={openProjectMenu}
          />
          <FieldButton
            glyph={TAG_MARK}
            label={t('tasks.field.tag')}
            value={draft.tags.length > 0 ? draft.tags.map((tag) => `#${tag}`).join(' ') : null}
            onPress={() => {
              setText((current) =>
                current.length === 0 || /\s$/u.test(current)
                  ? `${current}${TAG_MARK}`
                  : `${current} ${TAG_MARK}`,
              );
              focus();
            }}
          />
          <FieldButton
            icon="bell"
            label={t('tasks.field.reminder')}
            value={
              draft.time !== null && draft.reminderOffsetMinutes !== null
                ? reminderLabel(t, draft.reminderOffsetMinutes, draft.time)
                : null
            }
            disabled={draft.time === null}
            onPress={openReminderMenu}
          />
        </ScrollView>
        <IconButton icon="down" label={t('tasks.quick.close')} tone="default" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, minHeight: HIT_TARGET },
  input: { flex: 1, minHeight: HIT_TARGET, outlineStyle: 'none' as never },
  accessories: { flexDirection: 'row', alignItems: 'center' },
  accessory: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: HIT_TARGET - 8,
  },
  grow: { flex: 1 },
});
