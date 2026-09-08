import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useLiveQuery } from '@/db';
import { shopping as shoppingRepo } from '@/db/repositories';
import { useFavouriteAction } from '@/features/modules/useFavouriteAction';
import { useTranslate } from '@/i18n';
import type { ModuleDefinition } from '@/mocks/types';
import { useAccount } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  Header,
  Icon,
  Input,
  Loading,
  Screen,
  Text,
} from '@/ui';

export function ShoppingView({ module }: { module: ModuleDefinition }) {
  const t = useTranslate();
  const theme = useTheme();
  const router = useRouter();
  const account = useAccount();
  const favouriteAction = useFavouriteAction(module.id);

  const [draft, setDraft] = useState('');
  const list = useLiveQuery(() => shoppingRepo.list(account.id), [account.id]);
  const items = list.data ?? [];
  const openCount = items.filter((item) => !item.done).length;
  const doneCount = items.length - openCount;

  async function add() {
    const name = draft.trim();
    if (name.length === 0) return;
    setDraft('');
    await shoppingRepo.add({ accountId: account.id, name });
  }

  return (
    <Screen
      header={
        <Header
          title={module.name}
          subtitle={t('shopping.openCount', { count: openCount })}
          showBack
          onBack={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
          actions={[favouriteAction]}
        />
      }
      footer={
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input
              value={draft}
              onChangeText={setDraft}
              placeholder={t('shopping.placeholder')}
              onSubmitEditing={add}
              returnKeyType="done"
              accessibilityLabel={t('shopping.placeholder')}
            />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('shopping.add')}
            accessibilityState={{ disabled: draft.trim().length === 0 }}
            disabled={draft.trim().length === 0}
            onPress={add}
            style={({ pressed }) => [
              styles.addButton,
              {
                borderRadius: theme.radii.md,
                backgroundColor:
                  draft.trim().length === 0
                    ? theme.colors.disabledBackground
                    : pressed
                      ? theme.colors.accentStrong
                      : theme.colors.accent,
              },
            ]}
          >
            <Icon
              name="plus"
              size={22}
              color={
                draft.trim().length === 0 ? theme.colors.disabledText : theme.colors.textOnAccent
              }
            />
          </Pressable>
        </View>
      }
    >
      {list.loading && items.length === 0 ? <Loading /> : null}

      {!list.loading && items.length === 0 ? (
        <EmptyState icon="cart" title={t('shopping.empty.title')} body={t('shopping.empty.body')} />
      ) : null}

      {items.length > 0 ? (
        <Card padded={false} style={{ paddingHorizontal: theme.spacing.lg }}>
          {items.map((item, index) => (
            <View key={item.id}>
              {index > 0 ? <Divider /> : null}
              <View
                style={[styles.row, { paddingVertical: theme.spacing.md, gap: theme.spacing.md }]}
              >
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: item.done }}
                  accessibilityLabel={item.name}
                  onPress={() => shoppingRepo.setDone(item.id, !item.done)}
                  hitSlop={8}
                >
                  <Icon
                    name={item.done ? 'checkCircle' : 'circle'}
                    size={24}
                    color={item.done ? theme.colors.accent : theme.colors.borderStrong}
                  />
                </Pressable>
                <View style={{ flex: 1 }}>
                  <Text
                    variant="body"
                    tone={item.done ? 'faint' : 'default'}
                    style={item.done ? { textDecorationLine: 'line-through' } : undefined}
                  >
                    {item.name}
                  </Text>
                </View>
                {item.quantity ? (
                  <Text variant="label" tone="muted">
                    {item.quantity}
                  </Text>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${t('shopping.remove')}: ${item.name}`}
                  onPress={() => shoppingRepo.remove(item.id)}
                  hitSlop={8}
                >
                  <Icon name="trash" size={18} color={theme.colors.textFaint} />
                </Pressable>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      {doneCount > 0 ? (
        <Button
          label={t('shopping.clearDone', { count: doneCount })}
          variant="secondary"
          icon="trash"
          onPress={() => shoppingRepo.clearDone(account.id)}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  addButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
});
