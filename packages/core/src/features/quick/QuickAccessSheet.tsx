import { Pressable, StyleSheet, View } from 'react-native';

import { useI18n } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useTheme } from '@/theme';
import { AppIcon, Icon, ModuleIcon, Sheet, Text } from '@/ui';

import { appNameOf, useQuickAccess } from './useFavorites';

/** So hoch ist eine Zeile mit Logo und zwei Zeilen Text. */
const ROW_HEIGHT = 56;

/**
 * Hinzufuegen und Entfernen fuer den Schnellzugriff. Je App ein Block — die
 * laufende zuerst, dann die, in denen das Konto schon war. Eine Zeile ist
 * selbst der Schalter: antippen legt die Karte ins Karussell oder nimmt sie
 * heraus. Mit den Favoriten hat das nichts zu tun — das ist der Stern.
 */
export function QuickAccessSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const theme = useTheme();
  const favorites = useQuickAccess();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('quick.title')}>
      <View style={{ gap: theme.spacing.lg }}>
        {favorites.available.map((group) => (
          <View key={group.appId} style={{ gap: theme.spacing.sm }}>
            <View style={[styles.head, { gap: theme.spacing.sm }]}>
              <AppIcon appId={group.appId} size="sm" />
              <Text variant="section" numberOfLines={1}>
                {appNameOf(group.appId)}
              </Text>
            </View>
            <View
              style={[
                styles.card,
                theme.elevation.card,
                { backgroundColor: theme.colors.surface, borderRadius: theme.radii.md },
              ]}
            >
              {group.modules.map((module, index) => (
                <ToggleRow
                  key={module.id}
                  module={module}
                  first={index === 0}
                  active={favorites.isFavorite(group.appId, module.id)}
                  onToggle={() => favorites.toggle(group.appId, module.id)}
                />
              ))}
            </View>
          </View>
        ))}
      </View>
    </Sheet>
  );
}

function ToggleRow({
  module,
  first,
  active,
  onToggle,
}: {
  module: ModuleDefinition;
  first: boolean;
  active: boolean;
  onToggle: () => void;
}) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: active }}
      accessibilityLabel={module.name}
      onPress={onToggle}
      style={({ pressed }) => [
        styles.row,
        {
          minHeight: ROW_HEIGHT,
          paddingHorizontal: theme.spacing.md,
          gap: theme.spacing.md,
          borderTopWidth: first ? 0 : StyleSheet.hairlineWidth,
          borderTopColor: theme.colors.border,
          opacity: pressed ? 0.6 : 1,
        },
      ]}
    >
      <ModuleIcon moduleId={module.id} icon={module.icon} size="sm" />
      <View style={styles.text}>
        <Text
          variant="label"
          numberOfLines={1}
          style={{ fontSize: theme.fontSize.md, letterSpacing: theme.tracking.body }}
        >
          {module.name}
        </Text>
        {module.short ? (
          <Text variant="caption" tone="faint" numberOfLines={1}>
            {module.short}
          </Text>
        ) : null}
      </View>
      {/* Ein Haken, kein Stern: hier geht es um das Karussell, nicht um Favoriten. */}
      <Icon
        name={active ? 'checkCircle' : 'circle'}
        size={22}
        color={active ? theme.colors.accentStrong : theme.colors.borderStrong}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 },
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1, minWidth: 0, gap: 1 },
});
