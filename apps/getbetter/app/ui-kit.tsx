import { useRef, useState } from 'react';
import { View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  ContextMenu,
  Divider,
  EmptyState,
  FloatingButton,
  Header,
  Icon,
  Input,
  ListItem,
  Loading,
  Menu,
  measureAnchor,
  PlainList,
  PlainRow,
  Screen,
  SectionHeader,
  Sheet,
  Skeleton,
  SwipeRow,
  Text,
  Toggle,
  useUndo,
  type MenuAnchor,
  type MenuEntry,
} from '@/ui';
import { ICONS, type IconName } from '@/ui/Icon';

/** P-004: Jeder Baustein in allen Zustaenden. Nur fuer die Entwicklung. */
export default function UiKitScreen() {
  const t = useTranslate();
  const theme = useTheme();
  const undo = useUndo();

  const [text, setText] = useState('');
  const [chip, setChip] = useState('a');
  const [sheet, setSheet] = useState(false);
  const [fullSheet, setFullSheet] = useState(false);
  const [detentSheet, setDetentSheet] = useState(false);
  const [lastAction, setLastAction] = useState('—');
  const [fabCollapsed, setFabCollapsed] = useState(false);
  const [toggle, setToggle] = useState(true);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [menu, setMenu] = useState<{ anchor: MenuAnchor; open: boolean } | null>(null);
  const menuButton = useRef<View>(null);

  const demoMenu: readonly MenuEntry[] = [
    {
      key: 'list',
      label: 'Liste',
      icon: 'lines',
      selected: view === 'list',
      onPress: () => setView('list'),
    },
    {
      key: 'grid',
      label: 'Raster',
      icon: 'grid',
      selected: view === 'grid',
      onPress: () => setView('grid'),
    },
    { key: 'divider', divider: true },
    { key: 'disabled', label: 'Deaktiviert', disabled: true, onPress: () => undefined },
    {
      key: 'delete',
      label: 'Löschen',
      icon: 'trash',
      destructive: true,
      onPress: () =>
        undo.show({ message: 'Gelöscht', onUndo: () => setLastAction('Rückgängig gemacht') }),
    },
  ];

  async function openMenu() {
    const anchor = await measureAnchor(menuButton.current);
    if (anchor) setMenu({ anchor, open: true });
  }

  return (
    <Screen
      header={
        <Header
          title={t('ui.kit.title')}
          subtitle={t('ui.kit.subtitle')}
          showBack
          titleMenu={demoMenu}
        />
      }
    >
      <Card title="Text">
        <Text variant="display">Display 28</Text>
        <Text variant="title">Title 20</Text>
        <Text variant="section" tone="muted">
          Section 14
        </Text>
        <Text variant="body">Body 16 — der normale Fliesstext.</Text>
        <Text variant="label" tone="muted">
          Label 14 gedaempft
        </Text>
        <Text variant="caption" tone="faint">
          Caption 12 blass
        </Text>
        <Text variant="body" tone="accent">
          Akzent
        </Text>
        <Text variant="body" tone="danger">
          Warnung
        </Text>
      </Card>

      <Card title="Button">
        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Primary" onPress={() => undefined} />
          <Button label="Primary, laedt" loading onPress={() => undefined} />
          <Button label="Primary, deaktiviert" disabled onPress={() => undefined} />
          <Button label="Secondary" variant="secondary" icon="plus" onPress={() => undefined} />
          <Button label="Ghost" variant="ghost" onPress={() => undefined} />
          <Button label="Danger" variant="danger" icon="trash" onPress={() => undefined} />
          <Button label="Klein" size="sm" fullWidth={false} onPress={() => undefined} />
        </View>
      </Card>

      <Card title="Input">
        <View style={{ gap: theme.spacing.md }}>
          <Input label="Normal" placeholder="Tipp etwas" value={text} onChangeText={setText} />
          <Input
            label="Mit Icon und Hinweis"
            placeholder="Suchen"
            icon="search"
            hint="Ein Hinweis unter dem Feld."
            value={text}
            onChangeText={setText}
          />
          <Input
            label="Mit Fehler"
            placeholder="E-Mail"
            icon="mail"
            error="Das sieht nicht nach einer E-Mail aus."
            value={text}
            onChangeText={setText}
          />
          <Input
            label="Deaktiviert"
            value="Nicht aenderbar"
            onChangeText={() => undefined}
            editable={false}
          />
          <Input
            label="Mehrzeilig"
            placeholder="Notiz"
            multiline
            value={text}
            onChangeText={setText}
          />
        </View>
      </Card>

      <Card title="Badge und Chip">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Badge label="Neutral" />
          <Badge label="Akzent" tone="accent" icon="check" />
          <Badge label="Warnung" tone="danger" icon="warning" />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          <Chip label="Gewaehlt" selected={chip === 'a'} onPress={() => setChip('a')} />
          <Chip label="Nicht gewaehlt" selected={chip === 'b'} onPress={() => setChip('b')} />
          <Chip label="Deaktiviert" disabled onPress={() => undefined} />
        </View>
      </Card>

      <Card title="Toggle">
        <View style={{ flexDirection: 'row', gap: theme.spacing.lg, alignItems: 'center' }}>
          <Toggle value={toggle} onValueChange={setToggle} accessibilityLabel="Schalter" />
          <Toggle
            value={!toggle}
            onValueChange={(next) => setToggle(!next)}
            accessibilityLabel="Gegenteil"
          />
          <Toggle value onValueChange={() => undefined} accessibilityLabel="Deaktiviert" disabled />
        </View>
      </Card>

      <Card title="ListItem">
        <View>
          <ListItem title="Einfach" />
          <Divider />
          <ListItem title="Mit Untertitel" subtitle="Zweite Zeile" icon="calendar" />
          <Divider />
          <ListItem title="Antippbar" icon="doc" showChevron onPress={() => undefined} />
          <Divider />
          <ListItem title="Mit Badge" right={<Badge label="3" />} />
          <Divider />
          <ListItem title="Deaktiviert" icon="lock" disabled />
          <Divider />
          <ListItem title="Gefaehrlich" icon="trash" tone="danger" onPress={() => undefined} />
        </View>
      </Card>

      <Card title="Avatar">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Avatar name="Lea Meier" size={32} />
          <Avatar name="Jonas Meier" size={40} />
          <Avatar name="Nora" size={56} />
        </View>
      </Card>

      <Card title="Card, antippbar" subtitle="Untertitel" onPress={() => undefined}>
        <Text variant="label" tone="muted">
          Diese Karte reagiert auf Antippen.
        </Text>
      </Card>

      <Card title="Ladezustaende">
        <Loading compact />
        <View style={{ gap: theme.spacing.sm }}>
          <Skeleton height={20} />
          <Skeleton height={14} width="70%" />
          <Skeleton height={14} width="45%" />
        </View>
      </Card>

      <Card title="Leerer Zustand" padded={false}>
        <EmptyState
          title="Nichts gefunden"
          body="Hier steht, warum nichts da ist und was man tun kann."
          actionLabel="Nochmal"
          onAction={() => undefined}
        />
      </Card>

      <Card title="Sheet">
        <View style={{ gap: theme.spacing.sm }}>
          <Button label="Sheet oeffnen" variant="secondary" onPress={() => setSheet(true)} />
          <Button
            label="Vollbild-Sheet oeffnen"
            variant="secondary"
            onPress={() => setFullSheet(true)}
          />
        </View>
      </Card>

      <Card title="SwipeRow" subtitle={`Zuletzt: ${lastAction}`} padded={false}>
        <View>
          <SwipeRow
            leading={{
              key: 'done',
              label: 'Erledigt',
              icon: 'check',
              tone: 'accent',
              onPress: () => setLastAction('Erledigt'),
            }}
            trailing={[
              {
                key: 'plan',
                label: 'Planen',
                icon: 'calendar',
                tone: 'default',
                onPress: () => setLastAction('Planen'),
              },
              {
                key: 'remove',
                label: 'Löschen',
                icon: 'trash',
                tone: 'danger',
                onPress: () => setLastAction('Löschen'),
              },
            ]}
            trailingFull={{
              key: 'remove',
              label: 'Löschen',
              icon: 'trash',
              tone: 'danger',
              onPress: () =>
                undo.show({
                  message: 'Aufgabe gelöscht',
                  onUndo: () => setLastAction('Wiederhergestellt'),
                }),
            }}
          >
            <View style={{ padding: theme.spacing.lg }}>
              <Text>Nach rechts, halb oder ganz nach links</Text>
            </View>
          </SwipeRow>
          <Divider />
          <SwipeRow onDelete={() => setLastAction('onDelete')}>
            <View style={{ padding: theme.spacing.lg }}>
              <Text>Nur onDelete, wie bisher</Text>
            </View>
          </SwipeRow>
        </View>
      </Card>

      <Card title="Rückgängig">
        <View style={{ gap: theme.spacing.sm }}>
          <Button
            label="Mit Rückgängig"
            variant="secondary"
            onPress={() =>
              undo.show({ message: 'Archiviert', onUndo: () => setLastAction('Zurückgeholt') })
            }
          />
          <Button
            label="Nur Nachricht"
            variant="secondary"
            onPress={() => undo.show({ message: 'Gesendet', durationMs: 2000 })}
          />
        </View>
      </Card>

      <Card title="PlainList" subtitle="Eine Liste mit Abschnitten statt Karten">
        <View>
          <SectionHeader
            label="Heute"
            actionLabel="Alle 12"
            onAction={() => setLastAction('Alle 12')}
            first
          />
          <PlainList>
            <PlainRow
              leading={<Icon name="circle" size={22} color={theme.colors.textFaint} />}
              title="Eine Zeile, antippbar"
              onPress={() => setLastAction('Zeile')}
            />
            <PlainRow
              leading={<Icon name="circle" size={22} color={theme.colors.textFaint} />}
              title="Zwei Zeilen"
              subtitle="14:30 · Projekt"
            />
            <PlainRow
              leading={<Avatar name="Anna Muster" size={36} />}
              title="Drei Zeilen"
              subtitle="wird 36"
              meta="Morgen"
              trailing={<Icon name="star" size={18} color={theme.colors.textMuted} />}
            />
          </PlainList>
          <SectionHeader label="Ohne Spalte links" />
          <PlainList separatorInset="none">
            <PlainRow title="Linie über die ganze Breite" />
            <PlainRow title="Noch eine" />
          </PlainList>
        </View>
      </Card>

      <Card title="Menu und ContextMenu" subtitle={`Ansicht: ${view}`}>
        <View style={{ gap: theme.spacing.sm }}>
          <View ref={menuButton} collapsable={false}>
            <Button label="Menü öffnen" variant="secondary" onPress={() => void openMenu()} />
          </View>
          <ContextMenu
            items={demoMenu}
            onSelectMode={() => setLastAction('Auswahl (Android)')}
            accessibilityLabel="Kontextmenü"
          >
            <View
              style={{
                padding: theme.spacing.md,
                borderRadius: theme.radii.sm,
                backgroundColor: theme.colors.surfaceMuted,
              }}
            >
              <Text>Lange drücken</Text>
            </View>
          </ContextMenu>
        </View>
      </Card>

      <Card title="FloatingButton">
        <Button
          label={fabCollapsed ? 'Wort zeigen' : 'Nur Symbol'}
          variant="secondary"
          onPress={() => setFabCollapsed((value) => !value)}
        />
        <View style={{ height: 96 }}>
          <FloatingButton
            label="Neu"
            aboveTabBar
            menu={[
              {
                key: 'task',
                label: 'Aufgabe',
                icon: 'checkCircle',
                onPress: () => setLastAction('Aufgabe'),
              },
              { key: 'note', label: 'Notiz', icon: 'note', onPress: () => setLastAction('Notiz') },
              {
                key: 'mail',
                label: 'E-Mail',
                icon: 'mail',
                onPress: () => setLastAction('E-Mail'),
              },
              {
                key: 'birthday',
                label: 'Geburtstag',
                icon: 'gift',
                onPress: () => setLastAction('Geburtstag'),
              },
            ]}
          />
        </View>
        <View style={{ height: 96 }}>
          <FloatingButton
            label="E-Mail schreiben"
            icon="note"
            text="Schreiben"
            collapsed={fabCollapsed}
            aboveTabBar
            onPress={() => setLastAction('Schreiben')}
          />
        </View>
      </Card>

      <Card title="Sheet mit Stufen">
        <Button label="Mittel öffnen" variant="secondary" onPress={() => setDetentSheet(true)} />
      </Card>

      <Card title="Icons">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md }}>
          {(Object.keys(ICONS) as IconName[]).map((name) => (
            <View key={name} style={{ width: 56, alignItems: 'center', gap: 4 }}>
              <Icon name={name} size={20} />
              <Text variant="caption" tone="faint" align="center" numberOfLines={1}>
                {name}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Sheet" subtitle="Von unten">
        <View style={{ gap: theme.spacing.sm }}>
          <ListItem title="Erste Aktion" icon="check" onPress={() => setSheet(false)} />
          <Divider />
          <ListItem title="Zweite Aktion" icon="close" onPress={() => setSheet(false)} />
        </View>
      </Sheet>

      <Sheet
        visible={fullSheet}
        onClose={() => setFullSheet(false)}
        title="Vollbild"
        subtitle="Wie der Assistent"
        fullScreen
      >
        <Text variant="body" tone="muted">
          Nimmt den ganzen Bildschirm ein.
        </Text>
      </Sheet>

      <Sheet
        visible={detentSheet}
        onClose={() => setDetentSheet(false)}
        title="Stufen"
        subtitle="Am Griff nach oben gross, nach unten zu"
        detent="medium"
        onDetentChange={(detent) => setLastAction(`Stufe ${detent}`)}
      >
        {Array.from({ length: 14 }, (_, index) => (
          <ListItem key={`row-${index}`} title={`Zeile ${index + 1}`} />
        ))}
      </Sheet>

      <Menu
        visible={menu?.open ?? false}
        anchor={menu?.anchor ?? null}
        items={demoMenu}
        onClose={() => setMenu((current) => (current ? { ...current, open: false } : null))}
      />
    </Screen>
  );
}
