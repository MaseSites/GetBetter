import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme';

export type DividerProps = {
  /** Rueckt die Linie ein, damit sie unter Text statt unter dem Icon beginnt. */
  inset?: boolean;
};

export function Divider({ inset = false }: DividerProps) {
  const theme = useTheme();
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: theme.colors.border,
        marginLeft: inset ? theme.spacing.xxl + theme.spacing.md : 0,
      }}
    />
  );
}
