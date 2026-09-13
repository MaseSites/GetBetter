import { COMMANDS, type AppCommand } from '@/app/bridge';

import { intentOf } from './intent';

/**
 * Aus einem Satz einen Auftrag an eine andere Better-App machen. Was der Satz
 * will, erkennt `intentOf` (in allen vier Sprachen); hier wird daraus der Befehl.
 */
export type Routed = { command: AppCommand; subject: string };

export function route(text: string): Routed | null {
  const intent = intentOf(text);
  if (!intent) return null;
  const command =
    intent.kind === 'shopping'
      ? COMMANDS.shoppingAdd(intent.subject)
      : COMMANDS.choreAdd(intent.subject);
  return { command, subject: intent.subject };
}
