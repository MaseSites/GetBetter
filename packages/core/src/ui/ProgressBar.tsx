import { View } from 'react-native';

import { useTheme } from '@/theme';

export type ProgressBarProps = {
  /** 0 bis 1; mehr wird abgeschnitten. */
  share: number;
  /** Rot statt Akzent — wenn "voll" schlecht ist. */
  warn?: boolean;
};

/** Ein Balken, der sagt, wie viel vom Ganzen erreicht oder verbraucht ist. */
export function ProgressBar({ share, warn = false }: ProgressBarProps) {
  const theme = useTheme();
  const width = Math.max(0, Math.min(1, share));

  return (
    <View
      style={{
        width: '100%',
        height: theme.spacing.sm,
        borderRadius: theme.radii.pill,
        backgroundColor: theme.colors.surfaceMuted,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          width: `${width * 100}%`,
          height: '100%',
          backgroundColor: warn ? theme.colors.danger : theme.colors.accent,
        }}
      />
    </View>
  );
}
