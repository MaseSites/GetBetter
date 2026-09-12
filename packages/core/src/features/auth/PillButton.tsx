import { View } from 'react-native';

import { useTheme } from '@/theme';
import { Button, type ButtonProps } from '@/ui';

/**
 * Derselbe Knopf wie ueberall, nur in Pillenform: der Rahmen darum schneidet
 * die Ecken rund. So bleibt `ui/Button` die eine Stelle, an der ein Knopf
 * entsteht — die Begruessung und die Masken borgen sich nur seine Kontur.
 */
export function PillButton(props: ButtonProps) {
  const theme = useTheme();
  return (
    <View style={{ borderRadius: theme.radii.pill, overflow: 'hidden' }}>
      <Button {...props} />
    </View>
  );
}
