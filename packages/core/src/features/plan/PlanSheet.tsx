import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { currentApp, type AppId } from '@/app/identity';
import { cancelPlan, requestPlan, resumePlan, type PlanTerm } from '@/db';
import { dateOfDay } from '@/features/personalize/useAiBudget';
import { formatDayMonth, formatPrice, useI18n, useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import { AppIcon, Button, Icon, Segmented, Sheet, Text, type IconName } from '@/ui';

import { planBenefitsOf, planStateOf, type PlanBenefit, type PlanState } from './planState';
import { PLAN_PRICES_CHF, yearPriceOf } from './prices';
import { usePlanStatus } from './usePlanStatus';

const CHECK = 24;

type PlanSheetApi = {
  /** Das Abo-Fenster dieser App öffnen. */
  open: () => void;
  /** Zählt hoch, sobald hier etwas am Abo geändert wurde — wer den Stand zeigt, fragt dann neu. */
  revision: number;
};

const PlanSheetContext = createContext<PlanSheetApi>({ open: () => undefined, revision: 0 });

/**
 * Das Abo-Fenster, einmal für die ganze App (in `RootShell`). Überall, wo etwas
 * erst mit dem Abo geht — gesperrte Einstellungen, das aufgebrauchte
 * KI-Kontingent, die echten Stimmen —, öffnet `usePlanSheet().open()` dasselbe.
 */
export function PlanSheetProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [revision, setRevision] = useState(0);
  const api = useMemo<PlanSheetApi>(() => ({ open: () => setVisible(true), revision }), [revision]);

  return (
    <PlanSheetContext.Provider value={api}>
      {children}
      <PlanSheet
        visible={visible}
        onClose={() => setVisible(false)}
        onChanged={() => setRevision((current) => current + 1)}
      />
    </PlanSheetContext.Provider>
  );
}

export function usePlanSheet(): PlanSheetApi {
  return useContext(PlanSheetContext);
}

type PlanSheetProps = {
  visible: boolean;
  onClose: () => void;
  onChanged: () => void;
};

/**
 * Oben die App mit dem Preis, darunter zum Abhaken, was drin ist, unten der
 * Knopf. Bis es den Kauf im Store gibt, heisst er „Abo anfragen“ — der Admin
 * schaltet frei. Wer ein Abo hat, kündigt hier auch wieder: das gilt auf
 * Monatsende und lässt sich bis dahin zurücknehmen. Ohne Preis (BetterMoney)
 * steht nur, dass es bald kommt.
 */
function PlanSheet({ visible, onClose, onChanged }: PlanSheetProps) {
  const { t, language } = useI18n();
  const theme = useTheme();
  const { account } = useApp();
  const app = currentApp();
  const scope = account ? `${account.id}:${app.id}` : null;
  const paidHere = account?.paidApps?.includes(app.id) === true;
  const storedCancel = account?.planCancels?.[app.id] ?? null;
  // Neu gefragt beim Öffnen und sobald der Abgleich etwas am Abo bringt.
  const status = usePlanStatus(
    visible && account ? account.id : null,
    app.id,
    `${String(paidHere)}:${storedCancel ?? ''}`,
  );
  const [askedFor, setAskedFor] = useState<string | null>(null);
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const [cancelFailed, setCancelFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // Was hier gerade gekündigt oder zurückgenommen wurde — bis der Abgleich es bringt.
  const [ownCancel, setOwnCancel] = useState<{ scope: string; day: string | null } | null>(null);
  const [wanted, setWanted] = useState<PlanTerm>('month');

  const priceChf = status ? status.priceChf : PLAN_PRICES_CHF[app.id];
  const yearChf = status?.yearPriceChf ?? yearPriceOf(priceChf);
  const paid = status ? status.plan === 'paid' : paidHere;
  // Wer schon zahlt, sieht seine Laufzeit; sonst die gewählte.
  const term: PlanTerm = paid ? (status?.term ?? 'month') : wanted;
  // Wie viele Monate das Jahresabo schenkt — aus den Preisen selbst gerechnet.
  const freeMonths =
    priceChf !== null && yearChf !== null && priceChf > 0
      ? Math.max(0, Math.round(12 - yearChf / priceChf))
      : 0;
  const cancelsOn =
    ownCancel !== null && ownCancel.scope === scope
      ? ownCancel.day
      : (status?.cancelsOn ?? storedCancel);
  const state = planStateOf({
    priceChf,
    paid,
    pending: (scope !== null && askedFor === scope) || status?.request === 'pending',
    cancelled: cancelsOn !== null,
  });
  const endsOn = cancelsOn === null ? '' : formatDayMonth(language, dateOfDay(cancelsOn));

  function close() {
    setConfirming(false);
    setCancelFailed(false);
    onClose();
  }

  async function ask() {
    if (!account || busy || scope === null) return;
    setBusy(true);
    setFailedFor(null);
    const outcome = await requestPlan(account.id, app.id, wanted);
    setBusy(false);
    if (outcome === 'pending' || outcome === 'active') {
      setAskedFor(scope);
      onChanged();
      return;
    }
    // Nur ansehen: das sagt schon die Leiste „Nur ansehen“.
    if (outcome !== 'readOnly') setFailedFor(scope);
  }

  /** Kündigen (`true`) oder die Kündigung zurücknehmen (`false`). */
  async function setCancelled(cancelling: boolean) {
    if (!account || busy || scope === null) return;
    setBusy(true);
    setCancelFailed(false);
    const outcome = cancelling
      ? await cancelPlan(account.id, app.id)
      : await resumePlan(account.id, app.id);
    setBusy(false);
    setConfirming(false);
    if (outcome.ok) {
      setOwnCancel({ scope, day: outcome.cancelsOn });
      onChanged();
      return;
    }
    if (outcome.reason !== 'readOnly') setCancelFailed(true);
  }

  return (
    <Sheet visible={visible} onClose={close}>
      <View style={{ gap: theme.spacing.xl, paddingTop: theme.spacing.xs }}>
        <PlanHero
          appId={app.id}
          title={t('plan.title', { app: app.name })}
          price={
            priceChf === null
              ? null
              : formatPrice(language, term === 'year' && yearChf !== null ? yearChf : priceChf)
          }
          per={t(term === 'year' ? 'plan.perYear' : 'plan.perMonth')}
          note={
            term === 'year' && yearChf !== null
              ? t('plan.yearMonthly', { price: formatPrice(language, Math.round((yearChf / 12) * 100) / 100) })
              : null
          }
          soon={priceChf === null ? t('plan.priceSoon') : null}
          active={state === 'active'}
        />

        {state === 'available' && priceChf !== null ? (
          <View style={{ gap: theme.spacing.xs }}>
            <Segmented
              accessibilityLabel={t('plan.title', { app: app.name })}
              value={wanted}
              onChange={setWanted}
              options={[
                { value: 'month', label: t('plan.term.month') },
                { value: 'year', label: t('plan.term.year') },
              ]}
            />
            {freeMonths > 0 ? (
              <Text variant="caption" tone="accent" align="center">
                {t('plan.save', { count: freeMonths })}
              </Text>
            ) : null}
          </View>
        ) : null}

        {confirming ? (
          <CancelConfirm
            endsOn={endsOn}
            busy={busy}
            onKeep={() => setConfirming(false)}
            onCancel={() => void setCancelled(true)}
          />
        ) : (
          <>
            <View style={{ gap: theme.spacing.md }}>
              {planBenefitsOf(app.id).map((benefit) => (
                <BenefitRow key={benefit.title} benefit={benefit} />
              ))}
            </View>

            <View style={{ gap: theme.spacing.sm }}>
              {state === 'available' ? (
                <Button
                  label={t('plan.request')}
                  variant="signal"
                  icon="sparkles"
                  loading={busy}
                  onPress={() => void ask()}
                />
              ) : (
                <PlanStatusLine state={state} appName={app.name} endsOn={endsOn} />
              )}
              {state === 'cancelled' ? (
                <Button
                  label={t('plan.resume')}
                  variant="secondary"
                  loading={busy}
                  onPress={() => void setCancelled(false)}
                />
              ) : null}
              {failedFor !== null && failedFor === scope ? <Problem text={t('plan.error')} /> : null}
              {cancelFailed ? <Problem text={t('plan.cancel.error')} /> : null}
              <Button
                label={
                  state === 'active' || state === 'cancelled' ? t('common.close') : t('plan.later')
                }
                variant="ghost"
                onPress={close}
              />
              {state === 'active' ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('plan.cancel')}
                  onPress={() => setConfirming(true)}
                  hitSlop={theme.spacing.sm}
                  style={({ pressed }) => [
                    styles.quiet,
                    { paddingVertical: theme.spacing.xs, opacity: pressed ? 0.6 : 1 },
                  ]}
                >
                  <Text variant="caption" tone="danger">
                    {t('plan.cancel')}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {state === 'active' || state === 'cancelled' ? null : (
              <Text variant="caption" tone="faint" align="center">
                {t('plan.free')}
              </Text>
            )}
          </>
        )}
      </View>
    </Sheet>
  );
}

function Problem({ text }: { text: string }) {
  return (
    <View accessibilityLiveRegion="polite">
      <Text variant="caption" tone="danger" align="center">
        {text}
      </Text>
    </View>
  );
}

/** Die App und, gross, was sie im Monat kostet. */
function PlanHero({
  appId,
  title,
  price,
  per,
  note,
  soon,
  active,
}: {
  appId: AppId;
  title: string;
  price: string | null;
  /** „/Monat“ oder „/Jahr“. */
  per: string;
  /** Beim Jahresabo, was das im Monat macht. */
  note: string | null;
  soon: string | null;
  active: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          gap: theme.spacing.lg,
          padding: theme.spacing.lg,
          borderRadius: theme.radii.lg,
          backgroundColor: theme.colors.accentSoft,
        },
      ]}
    >
      <AppIcon appId={appId} size="lg" />
      <View style={[styles.grow, { gap: theme.spacing.xs }]}>
        <Text variant="label" tone="muted" numberOfLines={2}>
          {title}
        </Text>
        {price === null ? (
          <Text variant="body" tone="accent">
            {soon}
          </Text>
        ) : (
          <>
            <View style={[styles.price, { gap: theme.spacing.xs }]}>
              <Text variant="display" tone="accent">
                {price}
              </Text>
              <Text variant="label" tone="muted">
                {per}
              </Text>
            </View>
            {note ? (
              <Text variant="caption" tone="muted">
                {note}
              </Text>
            ) : null}
          </>
        )}
      </View>
      {active ? (
        <Icon name="checkCircle" size={theme.fontSize.display} color={theme.colors.accentStrong} />
      ) : null}
    </View>
  );
}

/** Eine Zeile der Liste: Häkchen, was drin ist, bei Bedarf ein Halbsatz dazu. */
function BenefitRow({ benefit }: { benefit: PlanBenefit }) {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing.md }]}>
      <View
        style={[
          styles.check,
          { borderRadius: theme.radii.pill, backgroundColor: theme.colors.accentSoft },
        ]}
      >
        <Icon name="check" size={theme.fontSize.sm} color={theme.colors.accentStrong} />
      </View>
      <View style={styles.grow}>
        <Text variant="body">{t(benefit.title)}</Text>
        {benefit.hint ? (
          <Text variant="caption" tone="muted">
            {t(benefit.hint)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

/** Die Rückfrage vor dem Kündigen — im Blatt selbst, ohne Systemdialog. */
function CancelConfirm({
  endsOn,
  busy,
  onKeep,
  onCancel,
}: {
  endsOn: string;
  busy: boolean;
  onKeep: () => void;
  onCancel: () => void;
}) {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.lg }}>
      <View style={{ gap: theme.spacing.xs }}>
        <Text variant="title">{t('plan.cancel.title')}</Text>
        <Text variant="label" tone="muted">
          {t('plan.cancel.body', { date: endsOn })}
        </Text>
      </View>
      <View style={{ gap: theme.spacing.sm }}>
        <Button label={t('plan.cancel.keep')} onPress={onKeep} />
        <Button label={t('plan.cancel.confirm')} variant="danger" loading={busy} onPress={onCancel} />
      </View>
    </View>
  );
}

const STATUS_ICON: Readonly<Record<Exclude<PlanState, 'available'>, IconName>> = {
  active: 'checkCircle',
  cancelled: 'clock',
  pending: 'clock',
  soon: 'info',
};

/** Statt des Knopfs: aktiv, gekündigt, angefragt oder „kommt bald“. */
function PlanStatusLine({
  state,
  appName,
  endsOn,
}: {
  state: Exclude<PlanState, 'available'>;
  appName: string;
  endsOn: string;
}) {
  const t = useTranslate();
  const theme = useTheme();
  const text =
    state === 'active'
      ? t('plan.active')
      : state === 'cancelled'
        ? t('plan.cancelled', { date: endsOn })
        : state === 'pending'
          ? t('plan.requested')
          : t('plan.soon', { app: appName });

  return (
    <View
      accessibilityLiveRegion="polite"
      style={[
        styles.row,
        theme.elevation.card,
        {
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radii.sm,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Icon
        name={STATUS_ICON[state]}
        size={theme.fontSize.lg}
        color={state === 'active' ? theme.colors.accentStrong : theme.colors.textMuted}
      />
      <Text variant="label" style={styles.grow}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  price: { flexDirection: 'row', alignItems: 'baseline' },
  check: { width: CHECK, height: CHECK, alignItems: 'center', justifyContent: 'center' },
  quiet: { alignSelf: 'center' },
});
