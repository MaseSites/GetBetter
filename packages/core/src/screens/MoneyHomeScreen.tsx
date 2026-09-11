import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  bills as billRepo,
  budgets as budgetRepo,
  dayKey,
  expenses as expenseRepo,
  monthKey,
  savings as savingsRepo,
  subscriptions as subscriptionRepo,
  useLiveQuery,
} from '@/db';
import { parseDay } from '@/features/shared/days';
import { formatDayMonth, formatMonthName, useI18n, type TranslationKey } from '@/i18n';
import { MODULES } from '@/mocks/modules';
import { useAccount } from '@/state/AppContext';
import { hueTint, useTheme } from '@/theme';
import {
  BigFigure,
  Divider,
  DueTag,
  EmptyRow,
  Header,
  Legend,
  ListCard,
  Panel,
  Screen,
  SectionHead,
  SegmentBar,
  Text,
  Track,
  type LegendItem,
  type Segment,
} from '@/ui';

const CATEGORY_KEYS = ['food', 'home', 'transport', 'fun', 'health', 'other'];
/** Mehr Kategorien passen nicht in eine Legende, ohne dass sie umbricht. */
const LEGEND_CATEGORIES = 3;
const ROW_HEIGHT = 50;

type Due = { text: string; now: boolean; late: boolean };

/**
 * Die Startseite von BetterMoney, wie im Entwurf «Geld»: der Monat als Titel,
 * oben was bis Monatsende bleibt, darunter Rechnungen, Abos und das Sparziel.
 */
export function MoneyHomeScreen() {
  const { t, language } = useI18n();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const month = monthKey();
  const today = dayKey();

  const expenseList = useLiveQuery(
    () => expenseRepo.listMonth(account.id, month),
    [account.id, month],
  );
  const limit = useLiveQuery(() => budgetRepo.limitOf(account.id, month), [account.id, month]);
  const openBills = useLiveQuery(() => billRepo.listOpen(account.id), [account.id]);
  const subscriptionList = useLiveQuery(() => subscriptionRepo.list(account.id), [account.id]);
  const monthly = useLiveQuery(() => subscriptionRepo.monthlyTotal(account.id), [account.id]);
  const goalList = useLiveQuery(() => savingsRepo.list(account.id), [account.id]);

  const whole = new Intl.NumberFormat(`${language}-CH`, { maximumFractionDigits: 0 });
  const cents = new Intl.NumberFormat(`${language}-CH`, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const nameOf = (id: string) => MODULES.find((module) => module.id === id)?.name ?? id;

  // Der Monat: ausgegeben, Budget, und was davon noch frei ist.
  const expenses = expenseList.data ?? [];
  const spent = expenses.reduce((sum, row) => sum + row.amountChf, 0);
  const budget = limit.data ?? null;
  const left = budget === null ? 0 : budget - spent;
  const over = budget !== null && left < 0;
  const free = Math.max(0, left);

  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = lastDay - now.getDate() + 1;

  const totals = new Map<string, number>();
  for (const row of expenses) {
    totals.set(row.category, (totals.get(row.category) ?? 0) + row.amountChf);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const rest = ranked.slice(LEGEND_CATEGORIES).reduce((sum, [, amount]) => sum + amount, 0);
  const categoryLabel = (key: string) =>
    CATEGORY_KEYS.includes(key) ? t(`budget.category.${key}` as TranslationKey) : key;
  const parts = [
    ...ranked
      .slice(0, LEGEND_CATEGORIES)
      .map(([key, amount]) => ({ key, label: categoryLabel(key), amount })),
    ...(rest > 0 ? [{ key: 'rest', label: t('money.restCategories'), amount: rest }] : []),
  ];

  const segments: Segment[] = [
    ...parts.map((part) => ({ key: part.key, value: part.amount, kind: 'ink' as const })),
    ...(budget !== null ? [{ key: 'free', value: free, kind: 'signal' as const }] : []),
  ];
  const legend: LegendItem[] = [
    ...parts.map((part) => ({
      key: part.key,
      label: t('money.legend', { label: part.label, amount: whole.format(part.amount) }),
      kind: 'ink' as const,
    })),
    ...(budget !== null && free > 0
      ? [{ key: 'free', label: t('money.free', { amount: whole.format(free) }), kind: 'signal' as const }]
      : []),
  ];

  const bills = openBills.data ?? [];
  const subscriptions = subscriptionList.data ?? [];
  const goals = goalList.data ?? [];

  function dueOf(day: string): Due {
    if (day < today) return { text: t('money.overdue'), now: false, late: true };
    if (day === today) return { text: t('bills.due.today'), now: true, late: false };
    return { text: formatDayMonth(language, parseDay(day)), now: false, late: false };
  }

  const shareOf = (saved: number, target: number) => (target > 0 ? Math.min(1, saved / target) : 0);
  const firstGoal = goals[0];

  return (
    <Screen
      contentStyle={{ paddingTop: theme.spacing.xs }}
      header={
        <Header
          crumb={{ label: t('area.money'), color: hueTint(theme, 'money').base }}
          title={formatMonthName(language, now)}
        />
      }
    >
      <Panel
        label={
          budget === null
            ? t('money.spentMonth')
            : over
              ? t('money.overBudget')
              : t('money.leftUntilEnd')
        }
        more={daysLeft === 1 ? t('money.lastDay') : t('money.daysLeft', { count: daysLeft })}
        onMore={() => router.push('/run/budget')}
      >
        <BigFigure
          value={whole.format(budget === null ? spent : Math.abs(left))}
          unit={budget === null ? t('money.chf') : t('money.ofChf', { amount: whole.format(budget) })}
          tone={over ? 'danger' : 'default'}
        />
        <SegmentBar segments={segments} />
        {legend.length > 0 ? <Legend items={legend} /> : null}
      </Panel>

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHead
          title={nameOf('bills')}
          count={t('money.openCount', { count: bills.length })}
          onPress={() => router.push('/run/bills')}
        />
        <ListCard>
          {bills.length === 0 ? (
            <EmptyRow text={t('bills.empty.title')} onPress={() => router.push('/run/bills')} />
          ) : (
            bills.slice(0, 4).map((bill, index) => (
              <View key={bill.id}>
                {index > 0 ? <Divider /> : null}
                <MoneyRow
                  title={bill.title}
                  amount={cents.format(bill.amountChf)}
                  due={dueOf(bill.dueDay)}
                  accessibilityLabel={`${bill.title}, ${cents.format(bill.amountChf)}. ${t('money.markPaid')}`}
                  // Antippen heisst bezahlt — wie in der vollen Ansicht.
                  onPress={() => void billRepo.setPaid(bill.id, true)}
                />
              </View>
            ))
          )}
        </ListCard>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHead
          title={nameOf('subscriptions')}
          count={t('money.perMonth', { amount: cents.format(monthly.data ?? 0) })}
          onPress={() => router.push('/run/subscriptions')}
        />
        <ListCard>
          {subscriptions.length === 0 ? (
            <EmptyRow
              text={t('subscriptions.empty.title')}
              onPress={() => router.push('/run/subscriptions')}
            />
          ) : (
            subscriptions.slice(0, 4).map((row, index) => (
              <View key={row.id}>
                {index > 0 ? <Divider /> : null}
                <MoneyRow
                  title={row.name}
                  subtitle={t(`subscriptions.interval.${row.interval}` as TranslationKey)}
                  amount={cents.format(row.amountChf)}
                  accessibilityLabel={`${row.name}, ${cents.format(row.amountChf)}`}
                  onPress={() => router.push('/run/subscriptions')}
                />
              </View>
            ))
          )}
        </ListCard>
      </View>

      <View style={{ gap: theme.spacing.sm }}>
        <SectionHead
          title={nameOf('savings')}
          count={
            goals.length === 1 && firstGoal
              ? t('money.percent', {
                  percent: Math.round(shareOf(firstGoal.savedChf, firstGoal.targetChf) * 100),
                })
              : goals.length > 1
                ? t('money.goals', { count: goals.length })
                : undefined
          }
          onPress={() => router.push('/run/savings')}
        />
        {goals.length === 0 ? (
          <ListCard>
            <EmptyRow text={t('savings.empty.title')} onPress={() => router.push('/run/savings')} />
          </ListCard>
        ) : (
          goals.slice(0, 2).map((goal) => {
            const share = shareOf(goal.savedChf, goal.targetChf);
            return (
              <Pressable
                key={goal.id}
                accessibilityRole="button"
                accessibilityLabel={`${goal.name}, ${whole.format(goal.savedChf)} ${t('money.ofChf', { amount: whole.format(goal.targetChf) })}`}
                onPress={() => router.push('/run/savings')}
                style={({ pressed }) => [
                  theme.elevation.card,
                  {
                    backgroundColor: pressed ? theme.colors.surfaceMuted : theme.colors.surface,
                    borderRadius: theme.radii.md,
                    padding: theme.spacing.lg,
                  },
                ]}
              >
                <Text variant="overline" tone="faint" numberOfLines={1}>
                  {goal.name}
                </Text>
                <View style={[styles.baseline, { gap: theme.spacing.sm, marginTop: theme.spacing.sm }]}>
                  <Text
                    style={{
                      fontFamily: theme.fontFamilyDisplay,
                      fontSize: theme.fontSize.stat,
                      lineHeight: theme.lineHeight.stat,
                      fontWeight: theme.fontWeight.bold,
                      letterSpacing: theme.tracking.title,
                    }}
                  >
                    {whole.format(goal.savedChf)}
                  </Text>
                  <Text variant="label" tone="faint">
                    {t('money.ofChf', { amount: whole.format(goal.targetChf) })}
                  </Text>
                  <View style={styles.grow} />
                  {goals.length > 1 ? (
                    <Text
                      variant="caption"
                      tone="faint"
                      style={{
                        fontSize: theme.fontSize.caption,
                        lineHeight: theme.lineHeight.caption,
                        fontWeight: theme.fontWeight.semibold,
                      }}
                    >
                      {t('money.percent', { percent: Math.round(share * 100) })}
                    </Text>
                  ) : null}
                </View>
                <Track share={share} />
              </Pressable>
            );
          })
        )}
      </View>
    </Screen>
  );
}

/** Eine Zeile mit Betrag rechts — Rechnung oder Abo. */
function MoneyRow({
  title,
  subtitle,
  amount,
  due,
  accessibilityLabel,
  onPress,
}: {
  title: string;
  subtitle?: string;
  amount: string;
  due?: Due;
  accessibilityLabel: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: ROW_HEIGHT,
          gap: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          backgroundColor: pressed ? theme.colors.surfaceMuted : 'transparent',
        },
      ]}
    >
      <View style={styles.grow}>
        <Text variant="body" numberOfLines={1} style={{ fontWeight: theme.fontWeight.medium }}>
          {title}
        </Text>
        {subtitle ? (
          <Text
            variant="caption"
            tone="faint"
            numberOfLines={1}
            style={{ fontSize: theme.fontSize.caption, lineHeight: theme.lineHeight.caption }}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={[styles.amount, { gap: theme.spacing.xs }]}>
        <Text
          style={{
            fontFamily: theme.fontFamilyDisplay,
            fontSize: theme.fontSize.md,
            lineHeight: theme.lineHeight.md,
            fontWeight: theme.fontWeight.bold,
            letterSpacing: theme.tracking.title,
          }}
        >
          {amount}
        </Text>
        {due ? <DueTag text={due.text} now={due.now} late={due.late} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  baseline: { flexDirection: 'row', alignItems: 'baseline' },
  grow: { flex: 1, minWidth: 0 },
  amount: { alignItems: 'flex-end' },
});
