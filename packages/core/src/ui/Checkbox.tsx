import { View } from 'react-native';

import { useTheme } from '@/theme';

import { Icon } from './Icon';

export type CheckboxProps = {
  checked: boolean;
  size?: number;
};

/**
 * Das Haekchen aus dem Entwurf: ein weiches Quadrat mit Linie, abgehakt voll
 * in Signalgruen mit Tinte darauf. Es ist nur die Form — drueckbar ist die
 * Zeile, in der es steht.
 */
export function Checkbox({ checked, size = 21 }: CheckboxProps) {
  const theme = useTheme();

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: theme.radii.xs,
        borderWidth: checked ? 0 : 1.7,
        borderColor: theme.colors.borderStrong,
        backgroundColor: checked ? theme.colors.accent : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? (
        <Icon name="check" size={Math.round(size * 0.62)} color={theme.colors.textOnAccent} />
      ) : null}
    </View>
  );
}
