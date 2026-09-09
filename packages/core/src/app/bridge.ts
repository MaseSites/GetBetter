import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { APPS, appOfModule, type AppId } from './identity';

/**
 * Wie GetBetter den anderen Better-Apps etwas auftraegt.
 *
 * Jede App ist ein eigenes Programm mit eigenem Speicher — GetBetter kann also
 * nicht einfach in die Einkaufsliste von BetterFamily schreiben. Stattdessen
 * schickt es einen Tiefenlink: `betterfamily://befehl/einkauf?text=2%20Bananen`.
 * Die andere App faengt ihn auf ihrer `befehl`-Route auf und fuehrt ihn aus.
 *
 * Ohne Server ist das der einzige ehrliche Weg. Er hat drei Grenzen, die man
 * kennen muss:
 *
 * - Er wirkt nur, wenn die andere App auf demselben Geraet installiert ist.
 * - Er geht nur in eine Richtung: GetBetter erfaehrt nicht, was daraus wurde.
 * - Im Browser gibt es keine Schemata; dort nehmen wir die Adresse des
 *   Entwicklungsservers, damit sich derselbe Ablauf ausprobieren laesst.
 */
export type AppCommand = {
  /** Welche App den Auftrag ausfuehren soll. */
  app: AppId;
  /** Was zu tun ist — jede App kennt ihre eigenen Befehle. */
  command: string;
  params: Readonly<Record<string, string>>;
};

/** Im Browser laeuft jede App auf einem eigenen Port. */
const WEB_PORTS: Readonly<Record<AppId, number>> = {
  getbetter: 8081,
  betterfamily: 8082,
  bettergym: 8083,
  betterai: 8084,
  bettermoney: 8085,
};

/** Die Startadresse einer App — zum Oeffnen, ohne einen Auftrag zu schicken. */
export function appUrl(app: AppId): string {
  if (Platform.OS === 'web') return `http://localhost:${WEB_PORTS[app]}/`;
  return `${APPS[app].scheme}://`;
}

export function commandUrl({ app, command, params }: AppCommand): string {
  const query = new URLSearchParams(params).toString();
  const path = `befehl/${command}${query ? `?${query}` : ''}`;

  if (Platform.OS === 'web') {
    return `http://localhost:${WEB_PORTS[app]}/${path}`;
  }
  return `${APPS[app].scheme}://${path}`;
}

/** Schickt den Auftrag los. `false` heisst: die App ist nicht da. */
export async function sendCommand(command: AppCommand): Promise<boolean> {
  const url = commandUrl(command);
  try {
    if (Platform.OS !== 'web' && !(await Linking.canOpenURL(url))) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Ob eine App auf diesem Geraet installiert ist. Im Browser nicht feststellbar. */
export async function isInstalled(app: AppId): Promise<boolean | undefined> {
  if (Platform.OS === 'web') return undefined;
  try {
    return await Linking.canOpenURL(`${APPS[app].scheme}://`);
  } catch {
    return false;
  }
}

/** Die Befehle, die GetBetter kennt, und wohin sie gehoeren. */
export const COMMANDS = {
  /** Etwas auf die Einkaufsliste setzen. */
  shoppingAdd: (text: string): AppCommand => ({
    app: appOfModule('shopping') ?? 'betterfamily',
    command: 'einkauf',
    params: { text },
  }),
  /** Ein Aemtli anlegen. */
  choreAdd: (text: string): AppCommand => ({
    app: appOfModule('chores') ?? 'betterfamily',
    command: 'aemtli',
    params: { text },
  }),
} as const;
