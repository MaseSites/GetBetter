import { useState } from 'react';
import { View } from 'react-native';

import { useTranslate } from '@/i18n';
import { useTheme } from '@/theme';
import {
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  EmptyState,
  Header,
  Icon,
  Input,
  ListItem,
  Loading,
  Screen,
  Sheet,
  Skeleton,
  Text,
} from '@/ui';
import { ICONS, type IconName } from '@/ui/Icon';

/** P-004: Jeder Baustein in allen Zustaenden. Nur fuer die Entwicklung. */
export default function UiKitScreen() {
  const t = useTranslate();
  const theme = useTheme();

  const [text, setText] = useState('');
  const [chip, setChip] = useState('a');
  const [sheet, setSheet] = useState(false);
  const [fullSheet, setFullSheet] = useState(false);

  return (
    <Screen header={<Header title={t('ui.kit.title')} subtitle={t('ui.kit.subtitle')} showBack />}>
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
          icon="search"
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
    </Screen>
  );
}
