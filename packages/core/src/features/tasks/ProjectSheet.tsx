import { useState } from 'react';
import { View } from 'react-native';

import { projects as projectRepo, type ProjectRow } from '@/db';
import { useI18n } from '@/i18n';
import { useTheme } from '@/theme';
import { Input, Sheet } from '@/ui';

export type ProjectEdit =
  | { kind: 'new' }
  | { kind: 'rename'; project: ProjectRow }
  | { kind: 'section'; project: ProjectRow };

/** Name eines Projekts oder eines neuen Abschnitts. Schliessen sichert. */
export function ProjectSheet({
  edit,
  accountId,
  onClose,
  onCreated,
}: {
  edit: ProjectEdit;
  accountId: string;
  onClose: () => void;
  onCreated: (project: ProjectRow) => void;
}) {
  const { t } = useI18n();
  const theme = useTheme();
  const [name, setName] = useState(edit.kind === 'rename' ? edit.project.name : '');

  const title =
    edit.kind === 'new'
      ? t('tasks.project.new')
      : edit.kind === 'rename'
        ? t('tasks.project.rename')
        : t('tasks.project.addSection');

  async function close() {
    const trimmed = name.trim();
    onClose();
    if (trimmed.length === 0) return;
    if (edit.kind === 'new') {
      onCreated(await projectRepo.save({ accountId, name: trimmed }));
      return;
    }
    const { project } = edit;
    if (edit.kind === 'rename') {
      if (trimmed !== project.name) {
        await projectRepo.save({ id: project.id, accountId: project.accountId, name: trimmed });
      }
      return;
    }
    const sections = project.sections ?? [];
    if (sections.includes(trimmed)) return;
    await projectRepo.save({
      id: project.id,
      accountId: project.accountId,
      name: project.name,
      sections: [...sections, trimmed],
    });
  }

  return (
    <Sheet visible onClose={() => void close()} title={title}>
      <View style={{ paddingBottom: theme.spacing.lg }}>
        <Input
          value={name}
          onChangeText={setName}
          placeholder={
            edit.kind === 'section'
              ? t('tasks.project.sectionPlaceholder')
              : t('tasks.project.namePlaceholder')
          }
          accessibilityLabel={title}
          returnKeyType="done"
          onSubmitEditing={() => void close()}
        />
      </View>
    </Sheet>
  );
}
