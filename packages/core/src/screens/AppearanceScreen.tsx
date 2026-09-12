import { Redirect } from 'expo-router';

/**
 * Aussehen ist ein Bereich der Einstellungen geworden — Modus, Voreinstellung,
 * Akzentfarbe und Hintergrund stehen dort unter „Darstellung“. Die alte Route
 * fuehrt weiter dorthin, damit gespeicherte Wege stimmen. Eine zweite
 * Oberflaeche fuers Aussehen gibt es bewusst nicht.
 */
export function AppearanceScreen() {
  return <Redirect href="/settings" />;
}
