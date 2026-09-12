import { useEffect, useEffectEvent, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { currentApp } from '@/app/identity';
import { useTranslate, type TranslationKey } from '@/i18n';
import { useApp } from '@/state/AppContext';
import { useTheme } from '@/theme';
import {
  APP_BACKDROP,
  APP_BACKDROPS,
  BACKDROPS,
  BACKDROP_KEYS,
  UPLOAD_PREFIX,
  resolveBackdrop,
  uploadIdOf,
  uploadSource,
} from '@/theme/backdrops';
import { Icon, Skeleton, Text } from '@/ui';

import { ImageReadError, canPickImage, pickImage } from './pickImage';
import { removeUpload, uploadBackdrop, type UploadError } from './uploads';

const COLUMNS = 3;
/** Kacheln stehen hoch wie ein Telefon, nur etwas gedrungener. */
const TILE_RATIO = 4 / 3;
/** Die Vorschaubilder sind 9:16 — unten angesetzt zeigt die Kachel das Motiv. */
const THUMB_OVERHANG = '133%';
/** Ring um die gewaehlte Kachel: Rand und Luft zum Bild. */
const RING = 2;

const UPLOAD_ERRORS: Readonly<Record<UploadError, TranslationKey>> = {
  offline: 'personalize.upload.offline',
  notYet: 'personalize.upload.notYet',
  rejected: 'personalize.upload.rejected',
  failed: 'personalize.upload.failed',
};

/**
 * Die Auswahl des Hintergrunds: das Bild der App, die mitgelieferten Bilder
 * und ein eigenes. Liest und schreibt selbst ueber `useApp()`, braucht darum
 * keine Props — so passt sie unter Aussehen wie ins Einrichten.
 */
export function BackdropPicker() {
  const t = useTranslate();
  const theme = useTheme();
  const { account, setBackdrop } = useApp();
  const appId = currentApp().id;

  const [width, setWidth] = useState(0);
  /** Was gerade getippt wurde, bis das Konto es bestaetigt. */
  const [chosen, setChosen] = useState<string | null>(null);
  /** Das eigene Bild dieser Sitzung — bleibt waehlbar, auch wenn gerade ein anderes gilt. */
  const [ownId, setOwnId] = useState(() => uploadIdOf(account?.backdrop));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);

  const resolved = resolveBackdrop(chosen ?? account?.backdrop, appId);
  const active = resolved.kind === 'preset' ? resolved.key : resolved.kind;
  const ownPreview = resolved.kind === 'upload' ? resolved.id : ownId;
  const picker = canPickImage();

  // Wer die Auswahl verlaesst, laesst kein eigenes Bild beim Dienst liegen, das
  // nirgends mehr gewaehlt ist — es waere sonst unerreichbar.
  const forgetUnused = useEffectEvent(() => {
    const kept = uploadIdOf(chosen ?? account?.backdrop);
    if (ownId && ownId !== kept) void removeUpload(ownId);
  });
  useEffect(() => () => forgetUnused(), []);

  async function choose(value: string): Promise<boolean> {
    setError(null);
    if (value === (account?.backdrop ?? APP_BACKDROP)) return true;
    setChosen(value);
    try {
      await setBackdrop(value);
      return true;
    } catch {
      setError('personalize.backdrop.saveFailed');
      return false;
    } finally {
      setChosen(null);
    }
  }

  async function uploadNew() {
    if (!account) return;
    setError(null);
    let dataUrl: string | null;
    try {
      // Direkt aus dem Tipp heraus, sonst oeffnet der Browser keinen Dialog.
      dataUrl = await pickImage();
    } catch (reason) {
      setError(
        reason instanceof ImageReadError
          ? 'personalize.upload.unreadable'
          : 'personalize.upload.failed',
      );
      return;
    }
    if (!dataUrl) return;

    setBusy(true);
    const previous = ownPreview;
    const result = await uploadBackdrop(account.id, dataUrl);
    if (!result.ok) {
      setBusy(false);
      setError(UPLOAD_ERRORS[result.error]);
      return;
    }
    const applied = await choose(`${UPLOAD_PREFIX}${result.id}`);
    setBusy(false);
    if (!applied) {
      void removeUpload(result.id);
      return;
    }
    setOwnId(result.id);
    if (previous && previous !== result.id) void removeUpload(previous);
  }

  function pressOwn() {
    if (busy) return;
    if (ownPreview && active !== 'upload') {
      void choose(`${UPLOAD_PREFIX}${ownPreview}`);
      return;
    }
    if (picker) void uploadNew();
  }

  function measure(event: LayoutChangeEvent) {
    setWidth(Math.floor(event.nativeEvent.layout.width));
  }

  const gap = theme.spacing.md;
  const tileWidth = width > 0 ? Math.floor((width - gap * (COLUMNS - 1)) / COLUMNS) : 0;
  // Tippen oeffnet den Dateidialog, wenn es kein Bild gibt oder das eigene schon gilt.
  const opensDialog = !ownPreview || active === 'upload';

  return (
    <View style={{ gap: theme.spacing.md }}>
      <View onLayout={measure} style={[styles.grid, { columnGap: gap, rowGap: gap }]}>
        {tileWidth > 0 ? (
          <>
            <Tile
              width={tileWidth}
              label={t('personalize.backdrop.app')}
              selected={active === 'app'}
              onPress={() => void choose(APP_BACKDROP)}
            >
              <Image
                source={APP_BACKDROPS[appId]}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
                style={styles.cover}
              />
            </Tile>

            {BACKDROP_KEYS.map((key) => (
              <Tile
                key={key}
                width={tileWidth}
                label={t(BACKDROPS[key].labelKey)}
                selected={active === key}
                onPress={() => void choose(key)}
              >
                <Image
                  source={BACKDROPS[key].thumb}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  style={styles.thumb}
                />
              </Tile>
            ))}

            <Tile
              width={tileWidth}
              label={busy ? t('personalize.backdrop.uploading') : t('personalize.backdrop.own')}
              selected={active === 'upload'}
              disabled={busy || (opensDialog && !picker)}
              hint={
                !picker && !ownPreview
                  ? t('personalize.backdrop.own.device')
                  : picker && active === 'upload'
                    ? t('personalize.backdrop.own.replace')
                    : undefined
              }
              onPress={pressOwn}
            >
              {ownPreview ? (
                <Image
                  source={uploadSource(ownPreview)}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                  style={styles.cover}
                />
              ) : null}
              {busy ? (
                <View style={StyleSheet.absoluteFill}>
                  <Skeleton height={Math.round(tileWidth * TILE_RATIO)} />
                </View>
              ) : opensDialog ? (
                <OwnPrompt picker={picker} overImage={Boolean(ownPreview)} />
              ) : null}
            </Tile>
          </>
        ) : null}
      </View>

      {error ? (
        <View accessibilityLiveRegion="polite">
          <Text variant="caption" tone="danger">
            {t(error)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** Was in der Kachel „Eigenes Bild“ steht, solange Tippen einen Dialog oeffnet. */
function OwnPrompt({ picker, overImage }: { picker: boolean; overImage: boolean }) {
  const t = useTranslate();
  const theme = useTheme();

  if (overImage) {
    // Ueber dem eigenen Bild nur ein kleines Zeichen: nochmal tippen tauscht es.
    return (
      <View style={[styles.corner, { padding: theme.spacing.xs }]}>
        <View
          style={[
            styles.chip,
            { backgroundColor: theme.colors.surface, borderRadius: theme.radii.pill },
          ]}
        >
          <Icon name="upload" size={14} color={theme.colors.text} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        StyleSheet.absoluteFill,
        styles.centre,
        { gap: theme.spacing.xs, padding: theme.spacing.sm },
      ]}
    >
      <Icon
        name={picker ? 'upload' : 'image'}
        size={22}
        color={picker ? theme.colors.textMuted : theme.colors.textFaint}
      />
      {picker ? null : (
        <Text variant="caption" tone="faint" align="center" numberOfLines={3}>
          {t('personalize.backdrop.own.deviceShort')}
        </Text>
      )}
    </View>
  );
}

type TileProps = {
  width: number;
  label: string;
  selected: boolean;
  disabled?: boolean;
  hint?: string;
  onPress: () => void;
  children: ReactNode;
};

function Tile({ width, label, selected, disabled = false, hint, onPress, children }: TileProps) {
  const theme = useTheme();
  const inner = width - RING * 4;

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={label}
      accessibilityHint={hint}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [{ width, gap: theme.spacing.xs, opacity: pressed ? 0.7 : 1 }]}
    >
      <View
        style={{
          padding: RING,
          borderWidth: RING,
          borderRadius: theme.radii.sm + RING * 2,
          borderColor: selected ? theme.colors.text : 'transparent',
        }}
      >
        <View
          style={[
            styles.preview,
            {
              width: inner,
              height: Math.round(inner * TILE_RATIO),
              borderRadius: theme.radii.sm,
              backgroundColor: theme.colors.background,
              borderColor: theme.colors.border,
            },
          ]}
        >
          {children}
          {selected ? (
            <View
              style={[
                styles.badge,
                {
                  top: theme.spacing.xs,
                  right: theme.spacing.xs,
                  borderRadius: theme.radii.pill,
                  backgroundColor: theme.colors.accent,
                },
              ]}
            >
              <Icon name="check" size={13} color={theme.colors.textOnAccent} />
            </View>
          ) : null}
        </View>
      </View>
      <Text
        variant="caption"
        tone={selected ? 'default' : 'muted'}
        align="center"
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  preview: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth },
  // Breite und Hoehe ausdruecklich: sonst nimmt das Bild im Browser seine eigene Groesse.
  cover: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
  thumb: { position: 'absolute', left: 0, bottom: 0, width: '100%', height: THUMB_OVERHANG },
  centre: { alignItems: 'center', justifyContent: 'center' },
  corner: { position: 'absolute', right: 0, bottom: 0 },
  chip: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
  badge: {
    position: 'absolute',
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
