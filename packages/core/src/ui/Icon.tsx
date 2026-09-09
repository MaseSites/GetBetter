import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme';

type IonName = ComponentProps<typeof Ionicons>['name'];

/**
 * Ein fester Satz von Namen. Bildschirme nennen nie direkt einen Ionicons-Namen,
 * damit der Satz spaeter in einem Schritt getauscht werden kann.
 */
export const ICONS = {
  calendar: 'calendar-outline',
  clock: 'time-outline',
  alarm: 'alarm-outline',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  circle: 'ellipse-outline',
  close: 'close',
  back: 'chevron-back',
  forward: 'chevron-forward',
  down: 'chevron-down',
  search: 'search-outline',
  sparkles: 'sparkles-outline',
  grid: 'apps-outline',
  compass: 'compass-outline',
  person: 'person-outline',
  people: 'people-outline',
  home: 'home-outline',
  sun: 'sunny-outline',
  cart: 'cart-outline',
  wallet: 'wallet-outline',
  heart: 'heart-outline',
  fitness: 'barbell-outline',
  meal: 'restaurant-outline',
  sleep: 'moon-outline',
  water: 'water-outline',
  pill: 'medkit-outline',
  doc: 'document-text-outline',
  note: 'create-outline',
  bell: 'notifications-outline',
  lock: 'lock-closed-outline',
  info: 'information-circle-outline',
  language: 'language-outline',
  settings: 'options-outline',
  logout: 'log-out-outline',
  plus: 'add',
  trash: 'trash-outline',
  send: 'arrow-up',
  car: 'car-outline',
  plant: 'leaf-outline',
  pet: 'paw-outline',
  travel: 'airplane-outline',
  repeat: 'repeat-outline',
  chart: 'stats-chart-outline',
  bulb: 'bulb-outline',
  shield: 'shield-checkmark-outline',
  broom: 'brush-outline',
  gift: 'gift-outline',
  book: 'book-outline',
  mail: 'mail-outline',
  phone: 'call-outline',
  star: 'star-outline',
  starFilled: 'star',
  warning: 'alert-circle-outline',
} as const satisfies Record<string, IonName>;

export type IconName = keyof typeof ICONS;

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, value);
}

export type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
};

export function Icon({ name, size = 20, color }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={ICONS[name]} size={size} color={color ?? theme.colors.text} />;
}
