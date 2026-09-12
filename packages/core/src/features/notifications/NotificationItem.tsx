import { useRouter } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

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
    default:
      return 'info';
  }
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
 * Eine Mitteilung als Karte, fuer „Was gibt's Neues“ und die Glocke. Die Knoepfe
 * haengen an der Art: Anfragen nimmt man an oder lehnt sie ab, eine E-Mail hat
 * man gesehen oder loescht sie, alles andere ist gelesen oder weg.
 *
 * Nach links wischen entfernt die Mitteilung — bei einer E-Mail die E-Mail selbst.
 * Die Karte ist nicht drueckbar, sie traegt eigene Knoepfe; bei einer E-Mail
 * oeffnet der Text daneben den Posteingang.
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

    if (kind === 'mail') {
      return (
        <>
          <Button
            label={t('news.action.seen')}
            size="sm"
            variant="secondary"
            icon="check"
            fullWidth={false}
            disabled={busy}
            onPress={() => void run(seen)}
          />
          <Button
            label={t('news.action.delete')}
            size="sm"
            variant="danger"
            icon="trash"
            fullWidth={false}
            disabled={busy}
            onPress={() => void run(deleteMail)}
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

  const summary = (
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
          {agoText(t, language, notification.createdAt)}
        </Text>
      </View>
    </View>
  );

  const deleteLabel =
    kind === 'mail' || place === 'inbox' ? t('news.action.delete') : t('news.action.dismiss');

  return (
    <SwipeRow
      radius={theme.radii.md}
      deleteLabel={deleteLabel}
      onDelete={() => void run(kind === 'mail' ? deleteMail : dismiss)}
    >
      <Card>
        {kind === 'mail' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('news.action.openMail', { subject: text.detail ?? '' })}
            onPress={() => router.push('/run/mail')}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            {summary}
          </Pressable>
        ) : (
          summary
        )}
        <View style={[styles.actions, { gap: theme.spacing.sm }]}>{actions()}</View>
        {problem ? (
          <Text variant="caption" tone="danger">
            {t(problem.key, problem.values)}
          </Text>
        ) : null}
      </Card>
    </SwipeRow>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1, minWidth: 0 },
  iconBox: { width: ICON_BOX, height: ICON_BOX, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' },
});
