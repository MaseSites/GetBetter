import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Kopfbereich, der beim Scrollen stehen bleibt. */
  header?: ReactNode;
  /** Fussbereich, der beim Scrollen stehen bleibt. */
  footer?: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  gap?: number;
  contentStyle?: StyleProp<ViewStyle>;
};

export function Screen({
  children,
  header,
  footer,
  scroll = true,
  padded = true,
  gap,
  contentStyle,
}: ScreenProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const inner: StyleProp<ViewStyle> = [
    {
      padding: padded ? theme.spacing.lg : 0,
      gap: gap ?? theme.spacing.lg,
    },
    contentStyle,
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.fill, { backgroundColor: theme.colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {header}
      {scroll ? (
        <ScrollView
          style={styles.fill}
          contentContainerStyle={inner}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.fill, inner]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            {
              padding: theme.spacing.lg,
              paddingBottom: theme.spacing.lg + insets.bottom,
              gap: theme.spacing.sm,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.colors.border,
              backgroundColor: theme.colors.background,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  footer: {},
});
