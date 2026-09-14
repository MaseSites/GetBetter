import { useEffect, useState } from 'react';
import {
  PanResponder,
  Platform,
  Pressable,
  Text as RNText,
  StyleSheet,
  TextInput,
  View,
  type LayoutChangeEvent,
  type PanResponderInstance,
  type TextStyle,
} from 'react-native';

import type { NoteBlock, NoteBlockKind } from '@/db/types';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useTheme, type Theme } from '@/theme';
import { ContextMenu, HIT_TARGET, Icon } from '@/ui';
import { isHorizontalSwipe } from '@/ui/gestures';

import { isListKind } from './blocks';
import { NoteImageBlock } from './NoteImage';
import { segmentsOf } from './search';

export type BlockHandlers = {
  change: (id: string, text: string) => void;
  backspace: (id: string) => void;
  focus: (id: string) => void;
  blur: (id: string) => void;
  toggleCheck: (id: string) => void;
  indent: (id: string, delta: number) => void;
  openImage: (uploadId: string) => void;
  removeImage: (id: string) => void;
  selection: (id: string, start: number, end: number) => void;
  register: (id: string, input: TextInput | null) => void;
  layout: (id: string, y: number) => void;
  exitFind: (id: string) => void;
};

export type BlockHit = { start: number; length: number; current: boolean };

export const KIND_LABEL_KEYS: Readonly<Record<NoteBlockKind, TranslationKey>> = {
  title: 'notes.kind.title',
  heading: 'notes.kind.heading',
  text: 'notes.kind.text',
  bullet: 'notes.kind.bullet',
  number: 'notes.kind.number',
  check: 'notes.kind.check',
  quote: 'notes.kind.quote',
  image: 'notes.kind.image',
};

/** So weit muss eine Listenzeile gewischt werden, bis sie ein- oder ausrueckt. */
const INDENT_SWIPE = 48;
/** Derselbe Kreis wie in den Aufgaben. */
const CHECK_SIZE = 22;
const BULLET_SIZE = 6;

/** Wischen auf einer Listenzeile: nach rechts einruecken, nach links ausruecken. */
class IndentSwipe {
  readonly responder: PanResponderInstance;
  private onIndent: (delta: number) => void = () => undefined;

  constructor() {
    this.responder = PanResponder.create({
      onMoveShouldSetPanResponderCapture: (_, gesture) =>
        isHorizontalSwipe(gesture, INDENT_SWIPE / 2),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx >= INDENT_SWIPE) this.onIndent(1);
        else if (gesture.dx <= -INDENT_SWIPE) this.onIndent(-1);
      },
    });
  }

  setOnIndent(onIndent: (delta: number) => void): void {
    this.onIndent = onIndent;
  }
}

function lineHeightOf(theme: Theme, kind: NoteBlockKind): number {
  if (kind === 'title') return theme.lineHeight.xl;
  if (kind === 'heading') return theme.lineHeight.lg;
  return theme.lineHeight.md;
}

function textStyleOf(theme: Theme, kind: NoteBlockKind, checked: boolean): TextStyle {
  const base: TextStyle = {
    fontFamily: theme.fontFamily,
    fontSize: theme.fontSize.md,
    lineHeight: theme.lineHeight.md,
    fontWeight: theme.fontWeight.regular,
    color: theme.colors.text,
  };
  switch (kind) {
    case 'title':
      return {
        ...base,
        fontFamily: theme.fontFamilyDisplay,
        fontSize: theme.fontSize.xl,
        lineHeight: theme.lineHeight.xl,
        fontWeight: theme.fontWeight.bold,
        letterSpacing: theme.tracking.title,
      };
    case 'heading':
      return {
        ...base,
        fontFamily: theme.fontFamilyDisplay,
        fontSize: theme.fontSize.lg,
        lineHeight: theme.lineHeight.lg,
        fontWeight: theme.fontWeight.bold,
      };
    case 'quote':
      return { ...base, color: theme.colors.textMuted };
    case 'check':
      return checked
        ? { ...base, color: theme.colors.textFaint, textDecorationLine: 'line-through' }
        : base;
    default:
      return base;
  }
}

type MarkerProps = {
  block: NoteBlock;
  number: number;
  lineHeight: number;
  textStyle: TextStyle;
  onToggle: () => void;
};

/** Was links vor dem Text steht: Punkt, Nummer, Kreis oder Zitatstrich. */
function Marker({ block, number, lineHeight, textStyle, onToggle }: MarkerProps) {
  const theme = useTheme();
  const t = useTranslate();
  const box = [
    styles.marker,
    { width: theme.spacing.xl, height: Math.max(lineHeight, CHECK_SIZE) },
  ];

  switch (block.kind) {
    case 'bullet':
      return (
        <View style={box}>
          <View
            style={{
              width: BULLET_SIZE,
              height: BULLET_SIZE,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.text,
            }}
          />
        </View>
      );
    case 'number':
      return (
        <View style={[box, styles.numberBox]}>
          <RNText style={textStyle}>{`${number}.`}</RNText>
        </View>
      );
    case 'check':
      return (
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: block.checked === true }}
          accessibilityLabel={block.text || t('notes.kind.check')}
          onPress={onToggle}
          hitSlop={(HIT_TARGET - CHECK_SIZE) / 2}
          style={box}
        >
          <Icon
            name={block.checked ? 'checkCircle' : 'circle'}
            size={CHECK_SIZE}
            color={block.checked ? theme.colors.accentStrong : theme.colors.borderStrong}
          />
        </Pressable>
      );
    case 'quote':
      return (
        <View
          style={[
            styles.quote,
            {
              width: theme.spacing.xs,
              borderRadius: theme.radii.pill,
              backgroundColor: theme.colors.borderStrong,
            },
          ]}
        />
      );
    default:
      return null;
  }
}

export type BlockViewProps = {
  block: NoteBlock;
  /** Die Nummer eines nummerierten Punkts, sonst 0. */
  number: number;
  handlers: BlockHandlers;
  /** In der Suche in der Notiz: Text mit markierten Stellen statt Eingabefeld. */
  finding: boolean;
  hits: readonly BlockHit[];
  autoFocus: boolean;
};

/** Ein Absatz der Notiz: ein eigenes Feld, gestaltet nach seiner Art. */
export function BlockView({ block, number, handlers, finding, hits, autoFocus }: BlockViewProps) {
  const theme = useTheme();
  const t = useTranslate();
  const [height, setHeight] = useState<number | null>(null);
  const [swipe] = useState(() => new IndentSwipe());

  useEffect(() => {
    swipe.setOnIndent((delta) => handlers.indent(block.id, delta));
  });

  const onLayout = (event: LayoutChangeEvent) =>
    handlers.layout(block.id, event.nativeEvent.layout.y);

  if (block.kind === 'image') {
    const uploadId = block.uploadId;
    return (
      <View onLayout={onLayout} style={{ paddingVertical: theme.spacing.sm }}>
        <ContextMenu
          items={[
            {
              key: 'remove',
              label: t('notes.image.remove'),
              icon: 'trash',
              destructive: true,
              onPress: () => handlers.removeImage(block.id),
            },
          ]}
          onPress={uploadId ? () => handlers.openImage(uploadId) : undefined}
          accessibilityLabel={t('notes.image.open')}
        >
          {uploadId ? <NoteImageBlock uploadId={uploadId} /> : null}
        </ContextMenu>
      </View>
    );
  }

  const lineHeight = lineHeightOf(theme, block.kind);
  const textStyle = textStyleOf(theme, block.kind, block.checked === true);
  // Im Browser waechst ein Textfeld nicht von selbst mit.
  const webHeight =
    Platform.OS === 'web' ? { height: Math.max(lineHeight, height ?? lineHeight) } : null;
  const swipeable = isListKind(block.kind) && Platform.OS !== 'web' && !finding;

  const body = finding ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={block.text || t(KIND_LABEL_KEYS[block.kind])}
      onPress={() => handlers.exitFind(block.id)}
      style={styles.grow}
    >
      <RNText style={textStyle}>
        {segmentsOf(block.text, hits).map((segment, index) =>
          segment.mark === 'none' ? (
            segment.text
          ) : (
            <RNText
              key={`${index}-${segment.mark}`}
              style={{
                color: segment.mark === 'current' ? theme.colors.textOnAccent : theme.colors.text,
                backgroundColor:
                  segment.mark === 'current' ? theme.colors.accent : theme.colors.accentSoft,
              }}
            >
              {segment.text}
            </RNText>
          ),
        )}
      </RNText>
    </Pressable>
  ) : (
    <TextInput
      ref={(input) => handlers.register(block.id, input)}
      value={block.text}
      onChangeText={(text) => handlers.change(block.id, text)}
      onKeyPress={(event) => {
        if (event.nativeEvent.key === 'Backspace') handlers.backspace(block.id);
      }}
      onSelectionChange={(event) =>
        handlers.selection(
          block.id,
          event.nativeEvent.selection.start,
          event.nativeEvent.selection.end,
        )
      }
      onFocus={() => handlers.focus(block.id)}
      onBlur={() => handlers.blur(block.id)}
      onContentSizeChange={
        Platform.OS === 'web'
          ? (event) => setHeight(event.nativeEvent.contentSize.height)
          : undefined
      }
      autoFocus={autoFocus}
      multiline
      scrollEnabled={false}
      autoCapitalize="sentences"
      accessibilityLabel={t(KIND_LABEL_KEYS[block.kind])}
      style={[styles.input, textStyle, webHeight]}
    />
  );

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.row,
        {
          marginLeft: (block.indent ?? 0) * theme.spacing.xl,
          paddingTop: block.kind === 'heading' ? theme.spacing.md : 0,
          gap:
            block.kind === 'text' || block.kind === 'title' || block.kind === 'heading'
              ? 0
              : theme.spacing.sm,
        },
      ]}
      {...(swipeable ? swipe.responder.panHandlers : {})}
    >
      <Marker
        block={block}
        number={number}
        lineHeight={lineHeight}
        textStyle={textStyle}
        onToggle={() => handlers.toggleCheck(block.id)}
      />
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  grow: { flex: 1 },
  marker: { alignItems: 'center', justifyContent: 'center' },
  numberBox: { alignItems: 'flex-end' },
  quote: { alignSelf: 'stretch' },
  input: {
    flex: 1,
    padding: 0,
    margin: 0,
    textAlignVertical: 'top',
    // Der Browser zeichnet sonst einen eigenen Fokusrahmen.
    outlineStyle: 'none' as never,
  },
});
