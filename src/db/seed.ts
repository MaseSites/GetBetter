import { alarms, events, notes, shopping, tasks } from './repositories';

/** Uhrzeit am heutigen Tag, optional um Tage verschoben. */
function at(hour: number, minute = 0, dayOffset = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

/**
 * Ein neues Konto startet nicht bei null — sonst laesst sich nichts beurteilen.
 * Das sind echte Zeilen in der Datenbank, keine Attrappen: sie lassen sich
 * abhaken, aendern und loeschen.
 */
export async function seedAccount(accountId: string): Promise<void> {
  await events.create({
    accountId,
    title: 'Standup Team Nord',
    startsAt: at(9, 0),
    endsAt: at(9, 20),
    location: 'Videocall',
  });
  await events.create({
    accountId,
    title: 'Zahnarzt Kontrolle',
    startsAt: at(14, 30),
    endsAt: at(15, 15),
    location: 'Praxis Bahnhofstrasse',
  });
  await events.create({
    accountId,
    title: 'Krafttraining',
    startsAt: at(18, 30),
    endsAt: at(19, 30),
    location: 'Fitnesscenter Puls',
  });
  await events.create({
    accountId,
    title: 'Elterngespräch',
    startsAt: at(16, 0, 1),
    endsAt: at(16, 30, 1),
    location: 'Schulhaus Wiesen',
  });
  await events.create({
    accountId,
    title: 'Ferien buchen, letzter Tag',
    startsAt: at(0, 0, 2),
    allDay: true,
  });

  await tasks.create({ accountId, title: 'Steuererklärung einreichen', dueAt: at(23, 59) });
  await tasks.create({ accountId, title: 'Rückruf Versicherung' });
  await tasks.create({ accountId, title: 'Velolicht ersetzen' });
  await tasks.create({ accountId, title: 'Badezimmer putzen', shared: true });

  await notes.create({
    accountId,
    title: 'Ideen Ferien Sommer',
    body: 'Tessin oder Bretagne. Zug statt Flug.\nWohnung mit Küche, drei Nächte reichen nicht.',
  });
  await notes.create({
    accountId,
    title: 'Einkauf Velo',
    body: 'Schloss, Rücklicht, Flickzeug.',
  });

  await shopping.add({ accountId, name: 'Milch', quantity: '2 l' });
  await shopping.add({ accountId, name: 'Poulet', quantity: '500 g' });
  await shopping.add({ accountId, name: 'Rucola' });
  await shopping.add({ accountId, name: 'Brot' });

  await alarms.create({
    accountId,
    time: '06:40',
    label: 'Arbeit',
    days: ['mo', 'di', 'mi', 'do', 'fr'],
  });
  await alarms.create({ accountId, time: '08:30', label: 'Wochenende', days: ['sa', 'so'] });
}
