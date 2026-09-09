import { notifyDataChanged } from './events';
import { db, newId } from './store';
import type {
  BillRow,
  BudgetRow,
  ExpenseRow,
  SavingsGoalRow,
  SubscriptionInterval,
  SubscriptionRow,
} from './types';

export { monthKey } from './pure';

function now(): string {
  return new Date().toISOString();
}

function changed<T>(value: T): T {
  notifyDataChanged();
  return value;
}

/** Auf Rappen gerundet — mehr Stellen gibt es im Portemonnaie nicht. */
function rappen(value: number): number {
  return Math.max(0, Math.round((value + Number.EPSILON) * 100) / 100);
}

/** Ausgaben, Budget, Rechnungen, Abos, Sparziele — der Datenbestand von BetterMoney. */
export const expenses = {
  listMonth(accountId: string, month: string) {
    return db.expenses.list({
      where: (row) => row.accountId === accountId && row.day.startsWith(month),
      sort: (a, b) => b.day.localeCompare(a.day) || b.createdAt.localeCompare(a.createdAt),
    });
  },

  async totalOf(accountId: string, month: string): Promise<number> {
    const rows = await db.expenses.list({
      where: (row) => row.accountId === accountId && row.day.startsWith(month),
    });
    return rows.reduce((total, row) => total + row.amountChf, 0);
  },

  async add(input: {
    accountId: string;
    day: string;
    amountChf: number;
    category: string;
    note?: string | null;
  }): Promise<ExpenseRow> {
    const row: ExpenseRow = {
      id: newId('ex'),
      accountId: input.accountId,
      day: input.day,
      amountChf: rappen(input.amountChf),
      category: input.category.trim(),
      note: input.note?.trim() || null,
      createdAt: now(),
    };
    return changed(await db.expenses.insert(row));
  },

  async remove(id: string) {
    await db.expenses.remove(id);
    changed(null);
  },
};

export const budgets = {
  async limitOf(accountId: string, month: string): Promise<number | null> {
    const row = await db.budgets.findBy(
      (entry) => entry.accountId === accountId && entry.month === month,
    );
    return row?.limitChf ?? null;
  },

  async setLimit(accountId: string, month: string, limitChf: number): Promise<BudgetRow> {
    const existing = await db.budgets.findBy(
      (entry) => entry.accountId === accountId && entry.month === month,
    );
    if (existing) {
      const updated = await db.budgets.update(existing.id, { limitChf: rappen(limitChf) });
      return changed(updated ?? existing);
    }
    const row: BudgetRow = { id: newId('bu'), accountId, month, limitChf: rappen(limitChf) };
    return changed(await db.budgets.insert(row));
  },
};

export const bills = {
  listOpen(accountId: string) {
    return db.bills.list({
      where: (row) => row.accountId === accountId && row.paidAt === null,
      sort: (a, b) => a.dueDay.localeCompare(b.dueDay),
    });
  },

  listPaid(accountId: string, limit = 5) {
    return db.bills.list({
      where: (row) => row.accountId === accountId && row.paidAt !== null,
      sort: (a, b) => (b.paidAt ?? '').localeCompare(a.paidAt ?? ''),
      limit,
    });
  },

  async openTotal(accountId: string): Promise<number> {
    const rows = await db.bills.list({
      where: (row) => row.accountId === accountId && row.paidAt === null,
    });
    return rows.reduce((total, row) => total + row.amountChf, 0);
  },

  async add(input: {
    accountId: string;
    title: string;
    amountChf: number;
    dueDay: string;
  }): Promise<BillRow> {
    const row: BillRow = {
      id: newId('bi'),
      accountId: input.accountId,
      title: input.title.trim(),
      amountChf: rappen(input.amountChf),
      dueDay: input.dueDay,
      paidAt: null,
      createdAt: now(),
    };
    return changed(await db.bills.insert(row));
  },

  async setPaid(id: string, paid: boolean) {
    await db.bills.update(id, { paidAt: paid ? now() : null });
    changed(null);
  },

  async remove(id: string) {
    await db.bills.remove(id);
    changed(null);
  },
};

export const subscriptions = {
  list(accountId: string) {
    return db.subscriptions.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.name.localeCompare(b.name),
    });
  },

  /** Was im Monat abgeht — Jahresabos anteilig. */
  async monthlyTotal(accountId: string): Promise<number> {
    const rows = await db.subscriptions.list({ where: (row) => row.accountId === accountId });
    return rows.reduce(
      (total, row) => total + (row.interval === 'year' ? row.amountChf / 12 : row.amountChf),
      0,
    );
  },

  async add(input: {
    accountId: string;
    name: string;
    amountChf: number;
    interval: SubscriptionInterval;
  }): Promise<SubscriptionRow> {
    const row: SubscriptionRow = {
      id: newId('su'),
      accountId: input.accountId,
      name: input.name.trim(),
      amountChf: rappen(input.amountChf),
      interval: input.interval,
      createdAt: now(),
    };
    return changed(await db.subscriptions.insert(row));
  },

  async remove(id: string) {
    await db.subscriptions.remove(id);
    changed(null);
  },
};

export const savings = {
  list(accountId: string) {
    return db.savingsGoals.list({
      where: (row) => row.accountId === accountId,
      sort: (a, b) => a.createdAt.localeCompare(b.createdAt),
    });
  },

  async add(input: {
    accountId: string;
    name: string;
    targetChf: number;
  }): Promise<SavingsGoalRow> {
    const row: SavingsGoalRow = {
      id: newId('sg'),
      accountId: input.accountId,
      name: input.name.trim(),
      targetChf: rappen(input.targetChf),
      savedChf: 0,
      createdAt: now(),
    };
    return changed(await db.savingsGoals.insert(row));
  },

  /** Etwas aufs Ziel legen. Ueber das Ziel hinaus geht es nicht. */
  async deposit(id: string, amountChf: number): Promise<void> {
    const goal = await db.savingsGoals.find(id);
    if (!goal) return;
    await db.savingsGoals.update(id, {
      savedChf: Math.min(goal.targetChf, rappen(goal.savedChf + amountChf)),
    });
    changed(null);
  },

  async remove(id: string) {
    await db.savingsGoals.remove(id);
    changed(null);
  },
};
