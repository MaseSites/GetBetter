import type { ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { useI18n } from '@/i18n';
import { numeric, useTheme } from '@/theme';
import { Text, usePressScale } from '@/ui';

import { CHECK_SIZE, CheckSquare, ROW_RADIUS } from './TrainingParts';
import { TRAINING } from './trainingType';

/**
 * Die Tabelle des Trainingshefts: SATZ · LETZTES MAL · KG · WDH · ✓, im Raster
 * 28 | 1fr | 64 | 52 | 34. Erledigte Zeilen liegen in der Senke mit
 * Signal-Haken, die jetzige Zeile ist weiss mit Tintenrand und traegt die
 * Felder — sie sehen aus wie Text, nicht wie Kaestchen.
 */

const NOW_BORDER = 1.5;

export type Columns = { kg: boolean; seconds: boolean };

function Cells({
  columns,
  number,
  last,
  kg,
  reps,
  check,
}: {
  columns: Columns;
  number: ReactNode;
  last: ReactNode;
  kg: ReactNode;
  reps: ReactNode;
  check: ReactNode;
}) {
  const theme = useTheme();
  return (
    <View style={[styles.row, { gap: theme.spacing.sm }]}>
      <View style={{ width: TRAINING.colSet }}>{number}</View>
      <View style={styles.grow}>{last}</View>
      {columns.kg ? <View style={{ width: TRAINING.colKg }}>{kg}</View> : null}
      <View style={{ width: TRAINING.colReps }}>{reps}</View>
      <View style={{ width: CHECK_SIZE }}>{check}</View>
    </View>
  );
}

/** Die Kopfzeile in kleinen Versalien. */
export function TableHead({ columns }: { columns: Columns }) {
  const { t } = useI18n();
  const theme = useTheme();
  // „SATZ“ ragt ueber seine Spalte in den Abstand daneben.
  const spillWidth = TRAINING.colSet + theme.spacing.sm;
  const head = (text: string, right = false, spill = false) => (
    <Text
      variant="overline"
      tone="faint"
      align={right ? 'right' : 'left'}
      numberOfLines={1}
      // „SATZ“ ist breiter als seine Spalte und darf hinausragen, wie im Entwurf.
      style={[
        { lineHeight: TRAINING.line11, letterSpacing: TRAINING.capsTracking },
        spill ? { width: spillWidth, maxWidth: spillWidth } : null,
      ]}
    >
      {text}
    </Text>
  );

  return (
    <View
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{
        paddingHorizontal: TRAINING.rowPadX,
        paddingTop: theme.spacing.md,
        paddingBottom: TRAINING.headPadBottom,
      }}
    >
      <Cells
        columns={columns}
        number={head(t('fit6.v.col.set'), false, true)}
        last={head(t('fit6.v.col.last'))}
        kg={head(t('fit6.v.col.kg'), true)}
        reps={head(columns.seconds ? t('fit6.v.col.seconds') : t('fit6.v.col.reps'), true)}
        check={null}
      />
    </View>
  );
}

/** Eine Zeile im Heft. `kind` sagt, wie sie aussieht; `onCheck` macht das Kaestchen zum Knopf. */
export function SetRow({
  kind,
  columns,
  number,
  last,
  kg,
  reps,
  note,
  warmup = false,
  label,
  checkLabel,
  onCheck,
  disabled = false,
}: {
  kind: 'done' | 'now' | 'open';
  columns: Columns;
  number: string;
  last: string;
  /** Text oder, in der jetzigen Zeile, das Feld. */
  kg: ReactNode;
  reps: ReactNode;
  /** Klein unter der Wiederholungszahl, z.B. die Reserve. */
  note?: string | null | undefined;
  warmup?: boolean | undefined;
  /** Was die Vorlesefunktion fuer die ganze Zeile sagt. */
  label: string;
  checkLabel?: string | undefined;
  onCheck?: (() => void) | undefined;
  disabled?: boolean | undefined;
}) {
  const theme = useTheme();
  const press = usePressScale();
  const faint = warmup || kind === 'open';
  const now = kind === 'now';
  // Der Rand der jetzigen Zeile liegt innen: die Zeile bleibt so hoch wie die anderen.
  const inset = now ? NOW_BORDER : 0;
  const value = (content: ReactNode) =>
    typeof content === 'string' ? (
      <Text
        variant="body"
        tone={faint ? 'faint' : 'default'}
        align="right"
        numberOfLines={1}
        style={[numeric, valueStyle(theme)]}
      >
        {content}
      </Text>
    ) : (
      content
    );

  const box = <CheckSquare state={kind} muted={warmup} />;

  return (
    <View
      style={{
        borderRadius: ROW_RADIUS,
        paddingVertical: theme.spacing.sm - inset,
        paddingHorizontal: TRAINING.rowPadX - inset,
        backgroundColor:
          kind === 'done' ? theme.colors.surfaceMuted : now ? theme.colors.surface : 'transparent',
        borderWidth: inset,
        borderColor: theme.colors.text,
      }}
    >
      <Cells
        columns={columns}
        number={
          <View accessible accessibilityLabel={label}>
            <Text
              variant="body"
              tone={faint ? 'faint' : 'default'}
              numberOfLines={1}
              style={[numeric, valueStyle(theme)]}
            >
              {number}
            </Text>
          </View>
        }
        last={
          <Text
            variant="label"
            tone="faint"
            numberOfLines={1}
            style={[numeric, { lineHeight: TRAINING.line13, fontWeight: theme.fontWeight.regular }]}
          >
            {last}
          </Text>
        }
        kg={value(kg)}
        reps={
          <View>
            {value(reps)}
            {note ? (
              <Text variant="caption" tone="faint" align="right" numberOfLines={1}>
                {note}
              </Text>
            ) : null}
          </View>
        }
        check={
          onCheck ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={checkLabel}
              accessibilityState={{ disabled, checked: kind === 'done' }}
              disabled={disabled}
              onPress={onCheck}
              onPressIn={press.onPressIn}
              onPressOut={press.onPressOut}
              hitSlop={theme.spacing.xs}
            >
              <Animated.View style={{ transform: [{ scale: press.scale }] }}>{box}</Animated.View>
            </Pressable>
          ) : (
            box
          )
        }
      />
    </View>
  );
}

const valueStyle = (theme: ReturnType<typeof useTheme>) => ({
  fontSize: TRAINING.rowSize,
  lineHeight: TRAINING.rowLine,
  fontWeight: theme.fontWeight.semibold,
  letterSpacing: theme.tracking.none,
});

/** Ein Zahlenfeld in der jetzigen Zeile: sieht aus wie der Text daneben, rechtsbuendig. */
export function CellInput({
  value,
  onChangeText,
  label,
  decimal = false,
  onSubmit,
}: {
  value: string;
  onChangeText: (text: string) => void;
  label: string;
  decimal?: boolean | undefined;
  onSubmit?: (() => void) | undefined;
}) {
  const theme = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      accessibilityLabel={label}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      returnKeyType="done"
      onSubmitEditing={onSubmit}
      selectTextOnFocus
      placeholder="–"
      placeholderTextColor={theme.colors.textFaint}
      style={[
        numeric,
        styles.field,
        {
          height: TRAINING.rowLine,
          color: theme.colors.text,
          fontFamily: theme.fontFamily,
          fontSize: TRAINING.rowSize,
          lineHeight: TRAINING.rowLine,
          fontWeight: theme.fontWeight.semibold,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  grow: { flex: 1, minWidth: 0 },
  field: {
    width: '100%',
    padding: 0,
    margin: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    textAlign: 'right',
  },
});
