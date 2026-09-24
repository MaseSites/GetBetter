import { useRouter } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { dayKey, useLiveQuery, type TaskRow } from '@/db';
import { tasks as taskRepo } from '@/db/repositories';
import { dueDayOf, priorityOf } from '@/db/taskFields';
import { useCelebrate } from '@/features/celebrate/CelebrationLayer';
import { relativeDay } from '@/features/shared/days';
import { DateSheet, type DateRequest } from '@/features/tasks/DateSheet';
import { POSTPONE_ICONS, postponeLabel, PRIORITY_MARKS } from '@/features/tasks/labels';
import { postponeKindsFor, type PostponeKind } from '@/features/tasks/postpone';
import { useTaskActions } from '@/features/tasks/useTaskActions';
import { useI18n } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Chip,
  Icon,
  Menu,
  measureAnchor,
  SectionHead,
  SwipeRow,
  Text,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';

import { dayTaskCount, dayTaskGroups } from './taskGroups';

/** So viele Aufgaben stehen auf der Startseite — der Rest in der Funktion. */
const VISIBLE = 6;
/** Der Kreis zum Abhaken — gleich gross wie in den Aufgaben. */
const CIRCLE = 22;
const CIRCLE_BORDER = 2;
/** Eine Heftzeile: jede Zeile gleich hoch, damit die Linien gleichmaessig laufen. */
const LINE = 52;
/** So viele Linien hat das Heft mindestens, wenn etwas darin steht. */
const MIN_LINES = 3;
/** Wie kraeftig der rote Rand ist, als Hex fuer `#RRGGBBAA`. */
const MARGIN_ALPHA = '59';

/**
 * Die Aufgaben des gezeigten Tages, unter dem Zeitstrahl — wie eine Seite im
 * Heft: gleich hohe Zeilen auf feinen Linien, links ein roter Rand, links
 * davon der Kreis, rechts davon der Text. Die Schrift bleibt die der App.
 *
 * Heute steht, was ueberfaellig ist („Alle auf heute“), was heute faellig ist
 * und was noch kein Datum hat; an einem anderen Tag, was dann faellig ist.
 * Wischt man den Zeitstrahl auf morgen, zeigt die Seite morgen.
 *
 * Ohne Aufgaben an diesem Tag steht der Bereich gar nicht da — neu angelegt
 * wird dann ueber das „+“ unten rechts. Mit `keepEmpty` bleibt er trotzdem
 * stehen (Ansicht „Jetzt“, wo er das Einzige unter der grossen Karte ist) und
 * sagt, dass nichts offen ist.
 *
 * Je Aufgabe: der Kreis hakt ab, **Verschieben** oeffnet ein kleines Menue
 * (Heute · Morgen · Nächste Woche · Datum wählen …), ein Tipp auf den Text
 * oeffnet sie. Nach rechts wischen heisst erledigt, nach links Verschieben
 * oder Loeschen — alles mit „Rückgängig“. Die letzte Zeile oeffnet unten die
 * Schnelleingabe der Aufgaben (`onAdd`, `TaskQuickAdd`).
 */
export function DayTasks({
  day,
  onAdd,
  keepEmpty = false,
}: {
  day: string;
  onAdd: () => void;
  /** Auch ohne Aufgaben stehen bleiben. */
  keepEmpty?: boolean;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { household } = useApp();
  const actions = useTaskActions();
  const celebrate = useCelebrate();
  const householdId = household?.id ?? null;
  // „Datum wählen …“ aus dem Verschieben-Menue — ein Blatt fuer die ganze Seite.
  const [pick, setPick] = useState<DateRequest | null>(null);

  const list = useLiveQuery(
    () => taskRepo.listOpen(account.id, householdId),
    [account.id, householdId],
  );
  const today = dayKey();
  const isToday = day === today;
  const groups = dayTaskGroups(list.data ?? [], day, today);
  const count = dayTaskCount(groups);
  // Ohne Aufgaben an diesem Tag steht hier nichts. Erst wenn geladen ist,
  // sonst blitzt der Bereich beim Öffnen kurz auf.
  if (!keepEmpty && list.data && count === 0) return null;
  const margin = `${theme.colors.danger}${MARGIN_ALPHA}`;
  // Der rote Rand steht zwischen Kreis und Text.
  const marginX = theme.spacing.md + CIRCLE + theme.spacing.md / 2;

  const sections = [
    { key: 'overdue', rows: groups.overdue, title: t('tasks.filter.overdue'), danger: true },
    { key: 'due', rows: groups.due, title: null, danger: false },
    { key: 'inbox', rows: groups.inbox, title: t('tasks.view.inbox'), danger: false },
  ];
  // Hoechstens `VISIBLE` Aufgaben, in der Reihenfolge der Gruppen.
  let room = VISIBLE;
  const shown = sections.map((section) => {
    const rows = section.rows.slice(0, room);
    room -= rows.length;
    return { ...section, rows };
  });
  const hidden = count - shown.reduce((sum, section) => sum + section.rows.length, 0);

  const openTasks = () => router.push('/run/tasks');
  const title = isToday
    ? t('today.tasks.title')
    : t('today.tasks.titleOn', { day: relativeDay(t, language, day) });

  /** Eine Heftzeile: gleich hoch, unten die Linie. */
  const ruled = {
    height: LINE,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  };
  const lines: ReactNode[] = [];

  for (const section of shown) {
    if (section.rows.length === 0) continue;
    if (section.title) {
      lines.push(
        <View
          key={`${section.key}-head`}
          style={[
            styles.line,
            styles.head,
            ruled,
            // Wie im Heft: die Ueberschrift sitzt auf der Linie.
            {
              paddingLeft: marginX + theme.spacing.md,
              paddingRight: theme.spacing.md,
              paddingBottom: theme.spacing.sm,
            },
          ]}
        >
          <Text variant="overline" tone={section.danger ? 'danger' : 'muted'} style={styles.grow}>
            {section.title}
          </Text>
          {section.key === 'overdue' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('tasks.overdue.allToToday')}
              onPress={() => void actions.postpone(groups.overdue, 'today')}
              hitSlop={theme.spacing.sm}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Text variant="label" tone="accent" style={{ fontWeight: theme.fontWeight.semibold }}>
                {t('tasks.overdue.allToToday')}
              </Text>
            </Pressable>
          ) : null}
        </View>,
      );
    }
    for (const task of section.rows) {
      lines.push(
        <TaskLine
          key={task.id}
          task={task}
          overdue={section.danger}
          kinds={postponeKindsFor(dueDayOf(task), today)}
          lineStyle={ruled}
          marginX={marginX}
          onComplete={() => {
            celebrate('done');
            void actions.complete(task);
          }}
          onPostpone={(kind) => void actions.postpone([task], kind)}
          onPick={() =>
            setPick((current) => ({
              id: (current?.id ?? 0) + 1,
              day: dueDayOf(task),
              time: task.dueTime ?? null,
              onApply: (schedule) => void actions.schedule([task], schedule),
            }))
          }
          onRemove={() => void actions.remove(task)}
          onOpen={() => router.push(`/run/tasks?task=${encodeURIComponent(task.id)}`)}
        />,
      );
    }
  }

  if (hidden > 0) {
    lines.push(
      <Pressable
        key="more"
        accessibilityRole="button"
        accessibilityLabel={t('today.tasks.more', { count: hidden })}
        onPress={openTasks}
        style={({ pressed }) => [
          styles.line,
          ruled,
          {
            paddingLeft: marginX + theme.spacing.md,
            paddingRight: theme.spacing.md,
            opacity: pressed ? 0.6 : 1,
          },
        ]}
      >
        <Text
          variant="label"
          tone="muted"
          style={[styles.grow, { fontWeight: theme.fontWeight.semibold }]}
        >
          {t('today.tasks.more', { count: hidden })}
        </Text>
        <Icon name="forward" size={15} color={theme.colors.textFaint} />
      </Pressable>,
    );
  }

  if (count === 0 && list.data) {
    lines.push(
      <View key="empty" style={[styles.line, ruled, { paddingLeft: marginX + theme.spacing.md }]}>
        <Text variant="label" tone="faint" numberOfLines={1}>
          {t('today.tasks.empty')}
        </Text>
      </View>,
    );
  }

  // Die letzte Zeile: neu fuer diesen Tag — mit derselben Leiste wie in den Aufgaben.
  const addLabel = isToday
    ? t('today.tasks.add')
    : t('today.tasks.addOn', { day: relativeDay(t, language, day) });
  lines.push(
    <Pressable
      key="add"
      accessibilityRole="button"
      accessibilityLabel={addLabel}
      onPress={onAdd}
      style={({ pressed }) => [styles.line, ruled, { opacity: pressed ? 0.6 : 1 }]}
    >
      <View style={[styles.lead, { width: marginX }]}>
        <Icon name="plus" size={18} color={theme.colors.textFaint} />
      </View>
      <Text
        variant="label"
        tone="faint"
        numberOfLines={1}
        style={[styles.grow, { paddingLeft: theme.spacing.md }]}
      >
        {addLabel}
      </Text>
    </Pressable>,
  );

  // Ein Heft hat Linien, auch wo noch nichts steht.
  for (let blank = lines.length; blank < MIN_LINES; blank += 1) {
    lines.push(<View key={`blank-${blank}`} style={ruled} />);
  }

  return (
    <View style={{ gap: theme.spacing.sm }}>
      <SectionHead
        title={title}
        count={count > 0 ? String(count) : undefined}
        onPress={openTasks}
      />
      <View
        style={[
          styles.page,
          theme.elevation.card,
          { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
        ]}
      >
        {lines}
        {/* Der rote Rand, ueber die ganze Seite — faengt keine Tipps ab. */}
        <View style={[styles.margin, { left: marginX, backgroundColor: margin }]} />
      </View>
      {pick ? <DateSheet request={pick} onClose={() => setPick(null)} /> : null}
    </View>
  );
}

/**
 * Eine Aufgabe auf ihrer Heftzeile: links vom Rand der Kreis, rechts davon
 * Titel mit „!!“ und darunter Uhrzeit oder wie lange sie schon wartet, ganz
 * rechts **Verschieben**. Ein Tipp darauf oeffnet ein kleines Menue neben dem
 * Knopf: die naechsten Tage und „Datum wählen …“ fuer jeden anderen Tag.
 * Kreis, Text und Knopf sind je ein eigener Knopf — keiner steckt im anderen.
 */
function TaskLine({
  task,
  overdue,
  kinds,
  lineStyle,
  marginX,
  onComplete,
  onPostpone,
  onPick,
  onRemove,
  onOpen,
}: {
  task: TaskRow;
  overdue: boolean;
  /** Was im Menue steht — „Heute“ nur, wenn sie nicht schon heute faellig ist. */
  kinds: readonly PostponeKind[];
  lineStyle: { height: number; borderBottomWidth: number; borderBottomColor: string };
  marginX: number;
  onComplete: () => void;
  onPostpone: (kind: PostponeKind) => void;
  onPick: () => void;
  onRemove: () => void;
  onOpen: () => void;
}) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const node = useRef<View>(null);
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const marks = PRIORITY_MARKS[priorityOf(task.priority)];
  const due = dueDayOf(task);
  const meta = [
    overdue && due ? relativeDay(t, language, due) : null,
    task.dueTime ?? null,
    task.repeat ? '↻' : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(' · ');
  // Nach links gewischt: noch weiter weg — was heute faellig ist, auf naechste
  // Woche, alles andere auf morgen.
  const later: PostponeKind = kinds.includes('today') ? 'tomorrow' : 'nextWeek';
  const items: MenuEntry[] = [
    ...kinds.map((kind): MenuEntry => ({
      key: kind,
      label: postponeLabel(t, kind),
      icon: POSTPONE_ICONS[kind],
      onPress: () => onPostpone(kind),
    })),
    { key: 'pickDivider', divider: true },
    { key: 'pick', label: t('tasks.plan.pick'), icon: 'calendar', onPress: onPick },
  ];

  async function openMenu() {
    const anchor = await measureAnchor(node.current);
    if (anchor) setMenu(anchor);
  }

  return (
    <SwipeRow
      leading={{
        key: 'done',
        label: t('tasks.action.done'),
        icon: 'check',
        tone: 'accent',
        onPress: onComplete,
      }}
      trailing={[
        {
          key: later,
          label: t(`tasks.postpone.${later}`),
          icon: POSTPONE_ICONS[later],
          tone: 'default',
          onPress: () => onPostpone(later),
        },
        {
          key: 'delete',
          label: t('common.delete'),
          icon: 'trash',
          tone: 'danger',
          onPress: onRemove,
        },
      ]}
      onDelete={onRemove}
    >
      <View
        style={[
          styles.line,
          lineStyle,
          { paddingRight: theme.spacing.md, backgroundColor: theme.colors.surface },
        ]}
      >
        <View style={[styles.lead, { width: marginX }]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('today.tasks.complete', { title: task.title })}
            onPress={onComplete}
            hitSlop={theme.spacing.md}
            style={[
              styles.circle,
              { borderColor: overdue ? theme.colors.danger : theme.colors.textFaint },
            ]}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={meta ? `${task.title}, ${meta}` : task.title}
          onPress={onOpen}
          style={({ pressed }) => [
            styles.grow,
            { paddingHorizontal: theme.spacing.md, opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text
            variant="label"
            numberOfLines={1}
            style={{ fontSize: theme.fontSize.md, fontWeight: theme.fontWeight.medium }}
          >
            {marks ? (
              <Text variant="label" tone="accent" style={{ fontWeight: theme.fontWeight.bold }}>
                {`${marks} `}
              </Text>
            ) : null}
            {task.title}
          </Text>
          {meta ? (
            <Text variant="caption" tone={overdue ? 'danger' : 'muted'} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </Pressable>
        <View ref={node} collapsable={false}>
          <Chip label={t('today.tasks.postpone')} onPress={() => void openMenu()} />
        </View>
        <Menu
          visible={menu !== null}
          anchor={menu}
          onClose={() => setMenu(null)}
          items={items}
          align="end"
          accessibilityLabel={t('today.tasks.postpone')}
        />
      </View>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  page: { overflow: 'hidden' },
  grow: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center' },
  head: { alignItems: 'flex-end' },
  lead: { alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch' },
  circle: { width: CIRCLE, height: CIRCLE, borderRadius: CIRCLE / 2, borderWidth: CIRCLE_BORDER },
  margin: { position: 'absolute', top: 0, bottom: 0, width: 1.5, pointerEvents: 'none' },
});
