import { Button, type ButtonProps } from '@/ui';

/**
 * Derselbe Knopf wie ueberall, nur in Pillenform. So bleibt `ui/Button` die
 * eine Stelle, an der ein Knopf entsteht — die Begruessung und die Masken
 * borgen sich nur seine runden Enden, samt Rand beim Umrissknopf.
 */
export function PillButton(props: ButtonProps) {
  return <Button {...props} pill />;
}
