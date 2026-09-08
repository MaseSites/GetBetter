export type Weekday = 'mo' | 'di' | 'mi' | 'do' | 'fr' | 'sa' | 'so';

export const WEEKDAYS: readonly Weekday[] = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so'];

export type Alarm = {
  id: string;
  /** "06:40" — die Anzeige formatiert das nicht um, es ist bereits eine Uhrzeit. */
  time: string;
  label: string;
  days: readonly Weekday[];
  enabled: boolean;
  /** Vom Kalender vorgeschlagen statt von Hand gestellt. */
  suggested?: boolean;
};

export const ALARMS: readonly Alarm[] = [
  {
    id: 'al-1',
    time: '06:40',
    label: 'Arbeit',
    days: ['mo', 'di', 'mi', 'do', 'fr'],
    enabled: true,
  },
  {
    id: 'al-2',
    time: '07:10',
    label: 'Erster Termin 09:00',
    days: ['di'],
    enabled: true,
    suggested: true,
  },
  {
    id: 'al-3',
    time: '08:30',
    label: 'Wochenende',
    days: ['sa', 'so'],
    enabled: false,
  },
  {
    id: 'al-4',
    time: '13:20',
    label: 'Kurzzeitwecker, Teig ruhen',
    days: [],
    enabled: false,
  },
];
