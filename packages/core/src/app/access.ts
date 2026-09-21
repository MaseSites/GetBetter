/**
 * Ob ein Konto diese App benutzen darf. Freigeschaltet oder weggenommen wird im
 * Admin (http://127.0.0.1:8091); die App liest nur das Ergebnis am Konto.
 */
export type AppAccess = 'ok' | 'disabled' | 'blocked';

export function accessOf(
  account: { disabled?: boolean; blockedApps?: readonly string[] },
  appId: string,
): AppAccess {
  if (account.disabled === true) return 'disabled';
  if (account.blockedApps?.includes(appId)) return 'blocked';
  return 'ok';
}

type AdminFields = {
  disabled?: boolean;
  blockedApps?: readonly string[];
  paidApps?: readonly string[];
};

function sameList(a: readonly string[] = [], b: readonly string[] = []): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/**
 * Ob sich geaendert hat, was nur der Admin setzt: Sperre, weggenommene Apps,
 * Abo. Dann nimmt die App das Konto aus dem Abgleich — ohne Neustart.
 */
export function adminFieldsChanged(a: AdminFields, b: AdminFields): boolean {
  return (
    (a.disabled === true) !== (b.disabled === true) ||
    !sameList(a.blockedApps, b.blockedApps) ||
    !sameList(a.paidApps, b.paidApps)
  );
}
