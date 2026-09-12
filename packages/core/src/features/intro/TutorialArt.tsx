import type { ReactNode } from 'react';
import { StyleSheet, View, type DimensionValue } from 'react-native';

import { modulesOfApp } from '@/mocks/modules';
import { useTranslate } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { hueTint, useTheme } from '@/theme';
import { Icon, ModuleIcon, Text } from '@/ui';

import { ClubAvatar } from './ClubAvatar';
import { SpeechBubble } from './SpeechBubble';

export type TutorialArtKind =
  | 'today'
  | 'quick'
  | 'areas'
  | 'news'
  | 'mail'
  | 'swipe'
  | 'assistant'
  | 'start'
  | 'functions'
  | 'chats';

/** Die Skizzen sind so breit wie ein kleines Telefon-Stueck, egal wie breit die Karte ist. */
const SKETCH_WIDTH = 248;
const BAR = 8;
const DOT = 10;
const STRIPE = 4;
const BADGE = 18;
const BELL = 56;
const GRABBER = 36;
const PEEK = 72;
const AVATAR = 92;

type Hue = 'organisation' | 'health' | 'household' | 'money' | 'ai';

/**
 * Kleine Skizzen fuer das Tutorial — aus denselben Bausteinen und Farben wie
 * die App, damit man das Gezeigte nachher wiedererkennt.
 */
export function TutorialArt({ kind }: { kind: TutorialArtKind }) {
  switch (kind) {
    case 'today':
      return <TodayArt />;
    case 'quick':
      return <QuickArt />;
    case 'areas':
      return <AreasArt />;
    case 'news':
      return <NewsArt />;
    case 'mail':
      return <MailArt />;
    case 'swipe':
      return <SwipeArt />;
    case 'assistant':
      return <AssistantArt />;
    case 'start':
      return <StartArt />;
    case 'functions':
      return <FunctionsArt />;
    case 'chats':
      return <ChatsArt />;
  }
}

/** Ein Platzhalter fuer eine Zeile Text. */
function Bar({ width, strong = false }: { width: DimensionValue; strong?: boolean }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width,
        height: BAR,
        borderRadius: theme.radii.pill,
        backgroundColor: strong ? theme.colors.borderStrong : theme.colors.border,
      }}
    />
  );
}

function Mini({
  children,
  row = true,
  clip = false,
}: {
  children: ReactNode;
  row?: boolean;
  /** Schneidet ab, was nicht mehr passt — so sieht ein Karussell aus. */
  clip?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        row ? styles.row : null,
        clip ? styles.clip : null,
        theme.elevation.card,
        {
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      {children}
    </View>
  );
}

function Lines({ first, second }: { first: DimensionValue; second: DimensionValue }) {
  const theme = useTheme();
  return (
    <View style={[styles.grow, { gap: theme.spacing.xs }]}>
      <Bar width={first} strong />
      <Bar width={second} />
    </View>
  );
}

function Dot({ hue }: { hue: Hue }) {
  const theme = useTheme();
  return (
    <View
      style={{
        width: DOT,
        height: DOT,
        borderRadius: theme.radii.pill,
        backgroundColor: hueTint(theme, hue).base,
      }}
    />
  );
}

function Sketch({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <View style={[styles.sketch, { gap: theme.spacing.sm }]}>{children}</View>;
}

function TodayArt() {
  const t = useTranslate();
  const theme = useTheme();
  const items: readonly Hue[] = ['organisation', 'health', 'money'];
  return (
    <Sketch>
      <Mini>
        <Icon name="calendar" size={16} color={theme.colors.accentStrong} />
        <Text variant="caption" tone="muted">
          {t('today.allDay')}
        </Text>
        <Bar width="40%" />
      </Mini>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <View style={styles.rail}>
          <View style={[styles.railLine, { backgroundColor: theme.colors.borderStrong }]} />
        </View>
        <View style={[styles.grow, { gap: theme.spacing.sm }]}>
          {items.map((hue, index) => (
            <Mini key={hue}>
              <View
                style={{
                  width: STRIPE,
                  alignSelf: 'stretch',
                  borderRadius: theme.radii.pill,
                  backgroundColor: hueTint(theme, hue).base,
                }}
              />
              <Lines first={index === 0 ? '70%' : '55%'} second="35%" />
            </Mini>
          ))}
        </View>
      </View>
    </Sketch>
  );
}

function QuickArt() {
  const theme = useTheme();
  return (
    <Sketch>
      <Mini clip>
        <ModuleIcon moduleId="calendar" icon="calendar" />
        <ModuleIcon moduleId="shopping" icon="grid" />
        <ModuleIcon moduleId="fitness" icon="grid" />
        <View
          style={[
            styles.center,
            styles.tile,
            {
              borderRadius: theme.radii.sm,
              borderColor: theme.colors.borderStrong,
            },
          ]}
        >
          <Icon name="plus" size={20} color={theme.colors.textMuted} />
        </View>
      </Mini>
      <View style={[styles.row, styles.center, { gap: theme.spacing.xs }]}>
        <Icon name="back" size={14} color={theme.colors.textFaint} />
        <Bar width="30%" />
        <Icon name="forward" size={14} color={theme.colors.textFaint} />
      </View>
    </Sketch>
  );
}

function AreasArt() {
  const theme = useTheme();
  const modules = [
    { id: 'calendar', icon: 'calendar' as const, star: false },
    { id: 'tasks', icon: 'check' as const, star: true },
    { id: 'notes', icon: 'grid' as const, star: false },
    { id: 'mail', icon: 'mail' as const, star: false },
    { id: 'birthdays', icon: 'star' as const, star: false },
    { id: 'weather', icon: 'grid' as const, star: false },
  ];
  return (
    <Sketch>
      <View style={[styles.grid, { gap: theme.spacing.md }]}>
        {modules.map((module) => (
          <View key={module.id} style={[styles.cell, { gap: theme.spacing.xs }]}>
            <View>
              <ModuleIcon moduleId={module.id} icon={module.icon} size="lg" />
              {module.star ? (
                <View
                  style={[
                    styles.badge,
                    styles.center,
                    theme.elevation.raised,
                    { borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
                  ]}
                >
                  <Icon name="starFilled" size={12} color={theme.colors.accentStrong} />
                </View>
              ) : null}
            </View>
            <Bar width="70%" />
          </View>
        ))}
      </View>
    </Sketch>
  );
}

function NewsArt() {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <Sketch>
      <View style={[styles.row, { gap: theme.spacing.md }]}>
        <View
          style={[
            styles.center,
            theme.elevation.raised,
            {
              width: BELL,
              height: BELL,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.surface,
            },
          ]}
        >
          <Icon name="bell" size={24} color={theme.colors.text} />
          <View
            style={[
              styles.bellDot,
              { borderRadius: theme.radii.pill, backgroundColor: theme.colors.danger },
            ]}
          />
        </View>
        <Text variant="title">{t('intro.tutorial.art.news')}</Text>
      </View>
      <Mini>
        <Dot hue="household" />
        <Lines first="65%" second="40%" />
      </Mini>
      <Mini>
        <Dot hue="organisation" />
        <Lines first="50%" second="70%" />
      </Mini>
    </Sketch>
  );
}

function MailArt() {
  const t = useTranslate();
  const theme = useTheme();
  const rows: readonly Hue[] = ['organisation', 'household', 'ai'];
  return (
    <Sketch>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <Icon name="mail" size={18} color={theme.colors.text} />
        <Text variant="label">{t('intro.tutorial.art.inbox')}</Text>
      </View>
      {rows.map((hue, index) => (
        <Mini key={hue}>
          <Dot hue={hue} />
          <Lines first={index === 1 ? '45%' : '62%'} second={index === 2 ? '50%' : '78%'} />
        </Mini>
      ))}
    </Sketch>
  );
}

function SwipeArt() {
  const t = useTranslate();
  const theme = useTheme();
  return (
    <Sketch>
      <View>
        {/* Die rote Flaeche liegt nur rechts, sonst schimmert sie an den runden Ecken durch. */}
        <View
          style={[
            styles.peek,
            {
              width: PEEK + theme.radii.md,
              paddingLeft: theme.radii.md,
              borderTopRightRadius: theme.radii.md,
              borderBottomRightRadius: theme.radii.md,
              backgroundColor: theme.colors.danger,
            },
          ]}
        >
          <View style={[styles.grow, styles.center, { gap: theme.spacing.xs }]}>
            <Icon name="trash" size={16} color={theme.colors.surface} />
            <Text variant="caption" style={{ color: theme.colors.surface }}>
              {t('common.delete')}
            </Text>
          </View>
        </View>
        <View style={{ marginRight: PEEK }}>
          <Mini>
            <Icon name="back" size={16} color={theme.colors.textFaint} />
            <Lines first="70%" second="45%" />
          </Mini>
        </View>
      </View>
      <View
        style={[
          theme.elevation.card,
          {
            gap: theme.spacing.sm,
            paddingBottom: theme.spacing.md,
            borderTopLeftRadius: theme.radii.xl,
            borderTopRightRadius: theme.radii.xl,
            borderBottomLeftRadius: theme.radii.md,
            borderBottomRightRadius: theme.radii.md,
            backgroundColor: theme.colors.surface,
          },
        ]}
      >
        <View style={[styles.center, { paddingTop: theme.spacing.sm }]}>
          <View
            style={{
              width: GRABBER,
              height: STRIPE,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.borderStrong,
            }}
          />
          <Icon name="down" size={16} color={theme.colors.textFaint} />
        </View>
        <View style={{ paddingHorizontal: theme.spacing.md }}>
          <Bar width="60%" />
        </View>
      </View>
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        <View
          style={[
            styles.center,
            styles.edge,
            theme.elevation.raised,
            { borderRadius: theme.radii.pill, backgroundColor: theme.colors.surface },
          ]}
        >
          <Icon name="back" size={18} color={theme.colors.text} />
        </View>
        <Text variant="caption" tone="muted">
          {t('common.back')}
        </Text>
      </View>
    </Sketch>
  );
}

function AssistantArt() {
  const t = useTranslate();
  const theme = useTheme();
  const { account } = useApp();
  const name = account?.assistantName?.trim() ?? '';
  return (
    <View style={[styles.sketch, styles.row, { gap: theme.spacing.md }]}>
      <ClubAvatar size={AVATAR} phase="idle" />
      <View style={styles.grow}>
        <SpeechBubble
          tail="left"
          text={
            name
              ? t('intro.tutorial.assistant.helloNamed', { assistant: name })
              : t('intro.tutorial.assistant.hello')
          }
        />
      </View>
    </View>
  );
}

function StartArt() {
  const theme = useTheme();
  const modules = modulesOfApp().slice(0, 2);
  return (
    <Sketch>
      {modules.map((module, index) => (
        <Mini key={module.id} row={false}>
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <ModuleIcon moduleId={module.id} icon={module.icon} size="sm" />
            <Bar width="40%" strong />
          </View>
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <Icon
              name={index === 0 ? 'checkCircle' : 'circle'}
              size={18}
              color={index === 0 ? theme.colors.accentStrong : theme.colors.borderStrong}
            />
            <Bar width="60%" />
          </View>
        </Mini>
      ))}
    </Sketch>
  );
}

function FunctionsArt() {
  const theme = useTheme();
  return (
    <Sketch>
      <View style={[styles.grid, { gap: theme.spacing.md }]}>
        {modulesOfApp()
          .slice(0, 6)
          .map((module) => (
            <View key={module.id} style={[styles.cell, { gap: theme.spacing.xs }]}>
              <ModuleIcon moduleId={module.id} icon={module.icon} size="lg" />
              <Bar width="70%" />
            </View>
          ))}
      </View>
    </Sketch>
  );
}

function ChatsArt() {
  const theme = useTheme();
  const ai = hueTint(theme, 'ai');
  return (
    <Sketch>
      {[0, 1, 2].map((row) => (
        <Mini key={row}>
          <View
            style={[
              styles.center,
              styles.chatDot,
              { borderRadius: theme.radii.pill, backgroundColor: ai.soft },
            ]}
          >
            <Icon name="sparkles" size={14} color={ai.base} />
          </View>
          <Lines first={row === 0 ? '72%' : '58%'} second="42%" />
        </Mini>
      ))}
      <View style={[styles.row, { gap: theme.spacing.sm }]}>
        {(['40%', '32%'] as const).map((width) => (
          <View
            key={width}
            style={[
              styles.row,
              {
                width,
                padding: theme.spacing.sm,
                borderRadius: theme.radii.pill,
                borderColor: theme.colors.border,
                borderWidth: StyleSheet.hairlineWidth,
                backgroundColor: theme.colors.surface,
              },
            ]}
          >
            <Bar width="100%" />
          </View>
        ))}
      </View>
    </Sketch>
  );
}

const styles = StyleSheet.create({
  sketch: { width: SKETCH_WIDTH, maxWidth: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  rail: { width: DOT, alignSelf: 'stretch', alignItems: 'center' },
  railLine: { flex: 1, width: 2 },
  tile: { width: 44, height: 44, borderWidth: 1.5, borderStyle: 'dashed' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cell: { width: 64, alignItems: 'center' },
  badge: { position: 'absolute', top: -6, right: -6, width: BADGE, height: BADGE },
  bellDot: { position: 'absolute', top: 12, right: 14, width: DOT, height: DOT },
  clip: { overflow: 'hidden' },
  peek: { position: 'absolute', right: 0, top: 0, bottom: 0 },
  edge: { width: 40, height: 40 },
  chatDot: { width: 28, height: 28 },
});
