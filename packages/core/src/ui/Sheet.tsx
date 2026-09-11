import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';

import { Icon } from './Icon';
import { usePhoneFrame } from './PhoneFrame';
import { Text } from './Text';

export type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: ReactNode;
  /** Vollbild statt von unten eingeschobener Karte. */
  fullScreen?: boolean;
};

export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  fullScreen = false,
}: SheetProps) {
  const theme = useTheme();
  const t = useTranslate();
  const frame = usePhoneFrame();

  return (
    <Modal
      visible={visible}
      transparent
      animationType={fullScreen ? 'slide' : 'fade'}
      onRequestClose={onClose}
    >
      {/* Im Browser liegt das Blatt im Telefon, nicht ueber dem ganzen Fenster. */}
      <View style={frame.framed ? styles.stage : styles.fill}>
        <View
          style={[
            styles.backdrop,
            { backgroundColor: theme.colors.overlay },
            frame.framed
              ? {
                  // Die Buehne darf das Blatt nicht ausfuellen, es soll so gross
                  // sein wie das Telefon. `flex: 0` waere hier falsch: daraus
                  // wird `flex-basis: 0%`, und die Hoehe faellt auf null.
                  flexGrow: 0,
                  flexShrink: 0,
                  flexBasis: 'auto',
                  width: frame.width,
                  height: frame.height,
                  borderRadius: 34,
                  overflow: 'hidden',
                }
              : null,
          ]}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            onPress={onClose}
            style={fullScreen ? styles.dismissAreaTop : styles.dismissArea}
          />
          <View
            style={[
              fullScreen ? styles.fullPanel : styles.panel,
              {
                backgroundColor: theme.colors.background,
                borderTopLeftRadius: theme.radii.xl,
                borderTopRightRadius: theme.radii.xl,
                paddingBottom: theme.spacing.xl,
              },
            ]}
          >
            <View style={[styles.grabberWrap, { paddingVertical: theme.spacing.md }]}>
              <View
                style={[
                  styles.grabber,
                  { backgroundColor: theme.colors.borderStrong, borderRadius: theme.radii.pill },
                ]}
              />
            </View>
            {title ? (
              <View
                style={[
                  styles.header,
                  {
                    paddingHorizontal: theme.spacing.edge,
                    paddingBottom: theme.spacing.md,
                    gap: theme.spacing.md,
                  },
                ]}
              >
                <View style={styles.headerText}>
                  <Text variant="title">{title}</Text>
                  {subtitle ? (
                    <Text variant="label" tone="muted">
                      {subtitle}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('common.close')}
                  onPress={onClose}
                  hitSlop={12}
                >
                  <Icon name="close" size={22} color={theme.colors.textMuted} />
                </Pressable>
              </View>
            ) : null}
            {/* Laengere Formulare muessen rollen, sonst ist der Knopf unten nicht erreichbar. */}
            <ScrollView
              style={styles.body}
              contentContainerStyle={{
                paddingHorizontal: theme.spacing.edge,
                paddingBottom: theme.spacing.lg,
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  dismissAreaTop: { height: 44 },
  panel: { maxHeight: '85%' },
  fullPanel: { flex: 1 },
  grabberWrap: { alignItems: 'center' },
  grabber: { width: 40, height: 4 },
  header: { flexDirection: 'row', alignItems: 'flex-start' },
  headerText: { flex: 1, gap: 2 },
  body: { flexShrink: 1 },
});
