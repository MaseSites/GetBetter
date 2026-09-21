import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { APPS, type AppIdentity } from '@/app/identity';
import {
  calendars as calendarRepo,
  dayKey,
  households as householdRepo,
  MAX_CALENDARS,
  MAX_HOUSEHOLDS,
  notifications as notificationRepo,
  shares as shareRepo,
  type NotificationKind,
  type NotificationRow,
} from '@/db';
import type { NotificationResult } from '@/db/notifications';
import { relativeDay } from '@/features/shared/days';
import { useI18n, type Language, type Translate, type TranslationKey } from '@/i18n';
import { useAccount, useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { Button, Card, Icon, SwipeRow, Text, type IconName } from '@/ui';

/**
 * Wo die Mitteilung steht. In „Was gibt's Neues“ heisst gelesen: aus den
 * Neuigkeiten, aber noch in der Glocke. In der Glocke heisst gelesen: weg.
 */
export type NotificationPlace = 'news' | 'inbox';

type Problem = { key: TranslationKey; values?: Record<string, number> };
type Outcome = { ok: true } | { ok: false; problem: Problem };

const OK: Outcome = { ok: true };
const FAILED: Outcome = { ok: false, problem: { key: 'news.error.failed' } };

const ICON_BOX = 36;
const ICON_SIZE = 18;
const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

function fromResult(result: NotificationResult): Outcome {
  return result.ok ? OK : FAILED;
}

function isRequest(kind: NotificationKind): boolean {
  return kind === 'calendarShare' || kind === 'calendarInvite' || kind === 'householdInvite';
}

function iconOf(kind: NotificationKind): IconName {
  switch (kind) {
    case 'calendarShare':
      return 'person';
    case 'calendarInvite':
      return 'calendar';
    case 'householdInvite':
      return 'people';
    case 'mail':
      return 'mail';
    case 'planApproved':
      return 'star';
    default:
      return 'info';
  }
}

const APP_BY_ID: Readonly<Record<string, AppIdentity | undefined>> = APPS;

/** Der Name der App aus dem Verweis — sonst, was der Dienst als Titel mitgab. */
function appNameOf(row: NotificationRow): string {
  return APP_BY_ID[row.ref?.app ?? '']?.name ?? (row.title ?? '').trim();
}

/** Der Satz zur Mitteilung. `title` und `body` sind Daten — den Satz baut erst die Oberflaeche. */
function sentenceOf(
  t: Translate,
  row: NotificationRow,
): { headline: string; detail: string | null } {
  const title = (row.title ?? '').trim();
  const body = (row.body ?? '').trim();
  const name = title || t('news.someone');

  switch (row.kind) {
    case 'calendarShare':
      return { headline: t('news.calendarShare', { name }), detail: null };
    case 'calendarInvite':
      return {
        headline: t('news.calendarInvite', { name, calendar: body || t('news.calendarFallback') }),
        detail: null,
      };
    case 'householdInvite':
      return {
        headline: t('news.householdInvite', {
          name,
          household: body || t('news.householdFallback'),
        }),
        detail: null,
      };
    case 'mail':
      return { headline: t('news.mail', { name }), detail: body || t('news.mail.noSubject') };
    case 'planApproved':
      return {
        headline: t('news.planApproved', { app: appNameOf(row) }),
        detail: t('news.planApproved.body'),
      };
    case 'planDeclined':
      return { headline: t('news.planDeclined', { app: appNameOf(row) }), detail: null };
    default:
      return { headline: title || t('news.system'), detail: body || null };
  }
}

/** "Gerade eben", "Vor 5 Min.", "Vor 3 Std." — ab gestern in Tagen oder als Datum. */
function agoText(t: Translate, language: Language, iso: string, now: Date = new Date()): string {
  const at = new Date(iso);
  const diff = now.getTime() - at.getTime();
  if (Number.isNaN(diff)) return '';
  if (diff < MINUTE_MS) return t('news.time.now');
  if (diff < HOUR_MS) return t('news.time.minutes', { count: Math.floor(diff / MINUTE_MS) });
  if (dayKey(at) === dayKey(now)) {
    return t('news.time.hours', { count: Math.floor(diff / HOUR_MS) });
  }
  return relativeDay(t, language, dayKey(at));
}

/**
 * Eine Anfrage ueber das Repository ihrer Quelle beantworten. Die Quelle raeumt
 * dabei ihre Mitteilungen selbst weg.
 */
async function respondTo(
  row: NotificationRow,
  accept: boolean,
  accountId: string,
): Promise<Outcome> {
  const ref = row.ref ?? {};

  if (row.kind === 'calendarShare' && ref.shareId) {
    await shareRepo.respond(ref.shareId, accept);
    return OK;
  }

  if (row.kind === 'calendarInvite' && ref.membershipId) {
    const full: Outcome = {
      ok: false,
      problem: { key: 'news.error.calendarLimit', values: { max: MAX_CALENDARS } },
    };
    if (accept && !(await calendarRepo.canAddMore(accountId))) return full;
    return (await calendarRepo.respond(ref.membershipId, accept)) ? OK : full;
  }

  if (row.kind === 'householdInvite' && ref.membershipId) {
    if (accept && !(await householdRepo.canJoinMore(accountId))) {
      return {
        ok: false,
        problem: { key: 'news.error.householdLimit', values: { max: MAX_HOUSEHOLDS } },
      };
    }
    // Faellt die Antwort ins Leere, war die Einladung schon zurueckgenommen.
    await householdRepo.respond(ref.membershipId, accept);
    return OK;
  }

  // Ohne Verweis gibt es nichts zu beantworten — die Mitteilung geht trotzdem.
  return OK;
}

export type NotificationItemProps = {
  notification: NotificationRow;
  place: NotificationPlace;
};

/**
 * Eine Mitteilung fuer „Was gibt's Neues“ und die Glocke. Anfragen und alles
 * andere stehen als Karte mit Knoepfen: annehmen oder ablehnen, gelesen oder weg.
 *
 * Eine E-Mail ist eine schmale Zeile ohne Knoepfe: antippen oeffnet die Mail
 * selbst, nach rechts wischen heisst gesehen, nach links wischen loescht die
 * E-Mail. Die anderen Karten tragen eigene Knoepfe und sind darum nicht drueckbar.
 */
export function NotificationItem({ notification, place }: NotificationItemProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const { refreshHousehold } = useApp();

  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);

  const kind = notification.kind;
  const mailId = notification.ref?.mailMessageId;
  const text = sentenceOf(t, notification);
  const ago = agoText(t, language, notification.createdAt);

  async function run(action: () => Promise<Outcome>) {
    if (busy) return;
    setBusy(true);
    setProblem(null);
    const outcome = await action().catch((): Outcome => FAILED);
    setBusy(false);
    if (!outcome.ok) setProblem(outcome.problem);
  }

  async function read(): Promise<Outcome> {
    return fromResult(
      place === 'news'
        ? await notificationRepo.markRead(notification.id)
        : await notificationRepo.remove(notification.id),
    );
  }

  async function dismiss(): Promise<Outcome> {
    return fromResult(await notificationRepo.remove(notification.id));
  }

  async function answer(accept: boolean): Promise<Outcome> {
    const outcome = await respondTo(notification, accept, account.id);
    if (!outcome.ok) return outcome;
    if (accept && kind === 'householdInvite') await refreshHousehold();
    // Die Quelle hat ihre Mitteilung schon entfernt; das hier faengt nur Reste ab.
    return dismiss();
  }

  async function seen(): Promise<Outcome> {
    if (mailId && !(await notificationRepo.mailSeen(mailId)).ok) return FAILED;
    return read();
  }

  async function deleteMail(): Promise<Outcome> {
    if (mailId && !(await notificationRepo.mailDelete(mailId)).ok) return FAILED;
    // Der Dienst nimmt die Mitteilung mit; bleibt sie stehen, geht sie hier.
    return dismiss();
  }

  /** Direkt in die Unterhaltung — wer sie aufmacht, hat die Mitteilung gelesen. */
  function openMail() {
    void notificationRepo.markRead(notification.id);
    router.push(mailId ? `/run/mail?message=${encodeURIComponent(mailId)}` : '/run/mail');
  }

  const problemText = problem ? (
    <Text variant="caption" tone="danger">
      {t(problem.key, problem.values)}
    </Text>
  ) : null;

  if (kind === 'mail') {
    const sender = (notification.title ?? '').trim() || t('news.someone');
    return (
      <View style={{ gap: theme.spacing.xs }}>
        <SwipeRow
          radius={theme.radii.md}
          deleteLabel={t('news.action.delete')}
          onDelete={() => void run(deleteMail)}
          leading={{
            key: 'seen',
            label: t('news.action.seen'),
            icon: 'check',
            tone: 'accent',
            onPress: () => void run(seen),
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('news.action.openMail', { subject: text.detail ?? '' })}
            onPress={openMail}
            style={({ pressed }) => [
              styles.mailRow,
              {
                gap: theme.spacing.md,
                paddingHorizontal: theme.spacing.md,
                paddingVertical: theme.spacing.sm,
                borderRadius: theme.radii.md,
                borderColor: theme.colors.border,
                backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
              },
            ]}
          >
            <Icon name="mail" size={ICON_SIZE} color={theme.colors.textMuted} />
            <View style={styles.grow}>
              <View style={[styles.mailLine, { gap: theme.spacing.sm }]}>
                <Text
                  variant="label"
                  numberOfLines={1}
                  style={[styles.grow, { fontWeight: theme.fontWeight.semibold }]}
                >
                  {sender}
                </Text>
                <Text variant="caption" tone="faint">
                  {ago}
                </Text>
              </View>
              <Text variant="caption" tone="muted" numberOfLines={1}>
                {text.detail}
              </Text>
            </View>
          </Pressable>
        </SwipeRow>
        {problemText}
      </View>
    );
  }

  function actions(): ReactNode {
    if (isRequest(kind)) {
      return (
        <>
          <Button
            label={t('news.action.accept')}
            size="sm"
            icon="check"
            fullWidth={false}
            disabled={busy}
            onPress={() => void run(() => answer(true))}
          />
          <Button
            label={t('news.action.decline')}
            size="sm"
            variant="ghost"
            fullWidth={false}
            disabled={busy}
            onPress={() => void run(() => answer(false))}
          />
        </>
      );
    }

    return (
      <>
        <Button
          label={t('news.action.read')}
          size="sm"
          variant="secondary"
          icon="check"
          fullWidth={false}
          disabled={busy}
          onPress={() => void run(read)}
        />
        {place === 'news' ? (
          <Button
            label={t('news.action.dismiss')}
            size="sm"
            variant="ghost"
            fullWidth={false}
            disabled={busy}
            onPress={() => void run(dismiss)}
          />
        ) : null}
      </>
    );
  }

  return (
    <SwipeRow
      radius={theme.radii.md}
      deleteLabel={place === 'inbox' ? t('news.action.delete') : t('news.action.dismiss')}
      onDelete={() => void run(dismiss)}
    >
      <Card>
        <View style={[styles.row, { gap: theme.spacing.md }]}>
          <View
            style={[
              styles.iconBox,
              { borderRadius: theme.radii.pill, backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Icon name={iconOf(kind)} size={ICON_SIZE} color={theme.colors.text} />
          </View>
          <View style={[styles.grow, { gap: theme.spacing.xs }]}>
            <Text variant="body" style={{ fontWeight: theme.fontWeight.semibold }}>
              {text.headline}
            </Text>
            {text.detail ? (
              <Text variant="label" tone="muted" numberOfLines={2}>
                {text.detail}
              </Text>
            ) : null}
            <Text variant="caption" tone="faint">
              {ago}
            </Text>
          </View>
        </View>
        <View style={[styles.actions, { gap: theme.spacing.sm }]}>{actions()}</View>
        {problemText}
      </Card>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
  mailRow: { flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth },
  mailLine: { flexDirection: 'row', alignItems: 'baseline' },
});
