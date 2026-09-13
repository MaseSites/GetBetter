import { useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { tasks as taskRepo, type TaskRow } from '@/db';
import { canPickImage, pickImage } from '@/features/personalize/pickImage';
import { uploadBackdrop } from '@/features/personalize/uploads';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { uploadSource } from '@/theme/backdrops';
import { HIT_TARGET, Icon, ListSeparator, ROW_MIN_HEIGHT, Text, useUndo } from '@/ui';

import { nextOrder, subtasksOf } from './lists';
import { CIRCLE_SIZE } from './TaskRowItem';

/** Bauplan: Anhänge als Kacheln von 64 pt. */
const TILE_SIZE = 64;
const CIRCLE_BORDER = 2;

/** Teilaufgaben mit Kreis; die letzte Zeile legt die naechste an. */
export function DetailSubtasks({
  task,
  rows,
  onOpen,
}: {
  task: TaskRow;
  rows: readonly TaskRow[];
  onOpen: (id: string) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const input = useRef<TextInput>(null);
  const [draft, setDraft] = useState('');
  const subtasks = subtasksOf(rows, task.id);

  async function add() {
    const title = draft.trim();
    if (title.length === 0) return;
    setDraft('');
    await taskRepo.create({
      accountId: task.accountId,
      householdId: task.householdId,
      shared: task.shared,
      title,
      parentId: task.id,
      order: nextOrder(subtasks),
    });
    input.current?.focus();
  }

  return (
    <View>
      {subtasks.map((subtask, index) => (
        <View key={subtask.id}>
          {index > 0 ? <ListSeparator inset={HIT_TARGET} /> : null}
          <View style={[styles.row, { minHeight: ROW_MIN_HEIGHT.one }]}>
            <Pressable
              accessibilityRole="checkbox"
              accessibilityState={{ checked: subtask.done }}
              accessibilityLabel={t('tasks.a11y.complete', { title: subtask.title })}
              onPress={() => void taskRepo.setDone(subtask.id, !subtask.done)}
              style={styles.hit}
            >
              <View
                style={[
                  styles.circle,
                  {
                    borderRadius: theme.radii.pill,
                    borderColor: subtask.done ? theme.colors.accent : theme.colors.borderStrong,
                    backgroundColor: subtask.done ? theme.colors.accent : 'transparent',
                  },
                ]}
              >
                {subtask.done ? (
                  <Icon name="check" size={theme.fontSize.sm} color={theme.colors.textOnAccent} />
                ) : null}
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={subtask.title}
              onPress={() => onOpen(subtask.id)}
              style={({ pressed }) => [
                styles.grow,
                { paddingVertical: theme.spacing.sm, opacity: pressed ? 0.6 : 1 },
              ]}
            >
              <Text
                variant="body"
                tone={subtask.done ? 'faint' : 'default'}
                numberOfLines={2}
                style={subtask.done ? styles.struck : undefined}
              >
                {subtask.title}
              </Text>
            </Pressable>
          </View>
        </View>
      ))}
      {subtasks.length > 0 ? <ListSeparator inset={HIT_TARGET} /> : null}
      <View style={[styles.row, { minHeight: ROW_MIN_HEIGHT.one }]}>
        <View style={styles.hit}>
          <Icon name="plus" size={20} color={theme.colors.textMuted} />
        </View>
        <TextInput
          ref={input}
          value={draft}
          onChangeText={setDraft}
          placeholder={t('tasks.detail.addSubtask')}
          placeholderTextColor={theme.colors.textFaint}
          accessibilityLabel={t('tasks.detail.addSubtask')}
          returnKeyType="done"
          submitBehavior="submit"
          onSubmitEditing={() => void add()}
          style={[
            styles.input,
            { fontFamily: theme.fontFamily, fontSize: theme.fontSize.md, color: theme.colors.text },
          ]}
        />
      </View>
    </View>
  );
}

/** Bilder als Kacheln und ein „+“. Hochgeladen wird ueber `/v1/uploads`. */
export function DetailAttachments({ task, accountId }: { task: TaskRow; accountId: string }) {
  const { t } = useI18n();
  const theme = useTheme();
  const undo = useUndo();
  const [busy, setBusy] = useState(false);
  const ids = task.attachmentIds ?? [];

  async function add() {
    if (!canPickImage()) {
      undo.show({ message: t('tasks.toast.attachUnavailable') });
      return;
    }
    try {
      const dataUrl = await pickImage();
      if (!dataUrl) return;
      setBusy(true);
      const result = await uploadBackdrop(accountId, dataUrl);
      if (!result.ok) {
        undo.show({
          message:
            result.error === 'offline'
              ? t('tasks.toast.attachOffline')
              : t('tasks.toast.attachFailed'),
        });
        return;
      }
      const fresh = await taskRepo.find(task.id);
      await taskRepo.update(task.id, {
        attachmentIds: [...(fresh?.attachmentIds ?? []), result.id],
      });
    } catch {
      undo.show({ message: t('tasks.toast.attachFailed') });
    } finally {
      setBusy(false);
    }
  }

  function remove(id: string) {
    const before = ids;
    void taskRepo.update(task.id, { attachmentIds: ids.filter((entry) => entry !== id) });
    undo.show({
      message: t('tasks.toast.attachRemoved'),
      onUndo: () => void taskRepo.update(task.id, { attachmentIds: before }),
    });
  }

  const tile = { width: TILE_SIZE, height: TILE_SIZE, borderRadius: theme.radii.sm };

  return (
    <View style={[styles.tiles, { gap: theme.spacing.sm }]}>
      {ids.map((id) => (
        <View key={id} style={[tile, styles.clip, { backgroundColor: theme.colors.surfaceMuted }]}>
          <Image
            source={uploadSource(id)}
            accessibilityLabel={t('tasks.detail.attachment')}
            resizeMode="cover"
            style={StyleSheet.absoluteFill}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tasks.detail.removeAttachment')}
            onPress={() => remove(id)}
            hitSlop={theme.spacing.sm}
            style={[
              styles.remove,
              {
                top: theme.spacing.xs,
                right: theme.spacing.xs,
                borderRadius: theme.radii.pill,
                backgroundColor: theme.colors.inverse,
                padding: 2,
              },
            ]}
          >
            <Icon name="close" size={12} color={theme.colors.onInverse} />
          </Pressable>
        </View>
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('tasks.detail.addAttachment')}
        accessibilityState={{ busy }}
        disabled={busy}
        onPress={() => void add()}
        style={({ pressed }) => [
          tile,
          styles.add,
          { borderColor: theme.colors.borderStrong, opacity: pressed || busy ? 0.5 : 1 },
        ]}
      >
        <Icon name="plus" size={22} color={theme.colors.textMuted} />
      </Pressable>
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
  grow: { flex: 1 },
  struck: { textDecorationLine: 'line-through' },
  input: { flex: 1, minHeight: HIT_TARGET, outlineStyle: 'none' as never },
  tiles: { flexDirection: 'row', flexWrap: 'wrap' },
  clip: { overflow: 'hidden' },
  remove: { position: 'absolute' },
  add: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
});
