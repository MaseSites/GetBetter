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
