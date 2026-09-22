import { useState } from 'react';

import { dayKey, projects as projectRepo, tasks as taskRepo, useLiveQuery } from '@/db';
import { dueAtOfDay } from '@/db/taskFields';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import { DateSheet, type DateRequest } from '@/features/tasks/DateSheet';
import { ActionRow } from '@/features/tasks/fields';
import { nextOrder, tagCounts } from '@/features/tasks/lists';
import { QuickAddBar } from '@/features/tasks/QuickAddBar';
import type { TaskDraft } from '@/features/tasks/quickAdd';
import { useAccount, useApp } from '@/state/AppContext';
import { isMenuDivider, Menu, PlainList, Sheet, type MenuAnchor, type MenuEntry } from '@/ui';

/** Mehr Eintraege passen nicht in ein Menue an der Leiste — dann als Blatt. */
const MAX_MENU_ITEMS = 7;

/**
 * Die Schnelleingabe der Aufgaben auf der Startseite — **dieselbe Leiste** wie
 * in der Funktion Aufgaben: ein Satz, darunter die erkannten Teile als Chips
 * und Datum · Priorität · Projekt · Tag · Erinnerung. Sie sitzt unten ueber
 * der Tastatur (`Screen footer`), der Tag ist der, den der Zeitstrahl gerade
 * zeigt. Menues und das Datums-Blatt gehen von hier auf — nie zwei Blaetter
 * uebereinander.
 */
export function TaskQuickAdd({ day, onClose }: { day: string; onClose: () => void }) {
  const account = useAccount();
  const { household } = useApp();
  const celebrate = useCelebrate();
  const householdId = household?.id ?? null;

  const projectQuery = useLiveQuery(
    () => projectRepo.list(account.id, householdId),
    [account.id, householdId],
  );
  const taskQuery = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const [menu, setMenu] = useState<{
    anchor: MenuAnchor;
    items: readonly MenuEntry[];
    open: boolean;
  } | null>(null);
  const [choices, setChoices] = useState<readonly MenuEntry[] | null>(null);
  const [dateRequest, setDateRequest] = useState<DateRequest | null>(null);

  const rows = taskQuery.data ?? [];
  const projects = projectQuery.data ?? [];
  const tags = tagCounts(rows).map((entry) => entry.tag);

  function openMenu(anchor: MenuAnchor, items: readonly MenuEntry[]) {
    if (items.filter((item) => !isMenuDivider(item)).length > MAX_MENU_ITEMS) {
      setChoices(items);
      return;
    }
    setMenu({ anchor, items, open: true });
  }

  function openDate(request: Omit<DateRequest, 'id'>) {
    setDateRequest((current) => ({ ...request, id: (current?.id ?? 0) + 1 }));
  }

  async function create(draft: TaskDraft) {
    celebrate('task');
    await taskRepo.create({
      accountId: account.id,
      householdId,
      title: draft.title,
      dueAt: draft.day ? dueAtOfDay(draft.day) : null,
      dueTime: draft.time,
      priority: draft.priority,
      projectId: draft.projectId,
      section: draft.section,
      tags: draft.tags.length > 0 ? [...draft.tags] : undefined,
      repeat: draft.repeat,
      reminderOffsetMinutes: draft.reminderOffsetMinutes,
      order: nextOrder(rows),
    });
  }

  return (
    <>
      <QuickAddBar
        defaults={{ day, projectId: null, section: null }}
        today={dayKey()}
        projects={projects}
        tags={tags}
        onSubmit={(draft) => void create(draft)}
        onClose={onClose}
        openMenu={openMenu}
        openDate={openDate}
      />

      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        items={menu?.items ?? []}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />

      <Sheet visible={choices !== null} onClose={() => setChoices(null)}>
        <PlainList separatorInset="none">
          {(choices ?? []).map((item) =>
            isMenuDivider(item) ? null : (
              <ActionRow
                key={item.key}
                icon={item.selected ? 'check' : item.icon}
                tone={item.destructive ? 'danger' : item.selected ? 'accent' : 'default'}
                label={item.label}
                onPress={() => {
                  setChoices(null);
                  item.onPress();
                }}
              />
            ),
          )}
        </PlainList>
      </Sheet>

      {dateRequest ? (
        <DateSheet
          key={dateRequest.id}
          request={dateRequest}
          onClose={() => setDateRequest(null)}
        />
      ) : null}
    </>
  );
}
