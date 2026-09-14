import { memo, useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { avatarPiecesOf } from '@/features/avatar/pieces';
import { avatarShapeKey, type AvatarStyle } from '@/features/avatar/style';
import { avatarTones } from '@/features/avatar/tones';
import { useAvatarStyle } from '@/features/avatar/useAvatarStyle';
import { useTheme } from '@/theme';

import {
  AvatarMotion,
  type AvatarPhase,
  type AvatarTarget,
  type PieceMotion,
} from './avatarMotion';
import { AVATAR_CANVAS, type AvatarPiece } from './avatarPieces';
import { useReducedMotion } from './useReducedMotion';

export type { AvatarPhase, AvatarTarget } from './avatarMotion';

export type ClubAvatarProps = {
  phase?: AvatarPhase;
  /** Kantenlaenge in Punkten. */
  size?: number;
  /**
   * Wie er aussieht. Ohne Angabe der Avatar des angemeldeten Kontos — und ohne
   * Konto `DEFAULT_AVATAR`.
   */
  style?: AvatarStyle;
  /**
   * Im Ruhezustand wandert nur der Blick, nicht der ganze Koerper. Ruhiger —
   * gedacht fuer den Assistenten, wo er lange einfach dasteht.
   */
  gazeOnly?: boolean;
  /** Steht einfach da: ohne Flug, Schweben und Blinzeln — fuer kleine Vorschauen. */
  still?: boolean;
  /** Ziel fuer `scatter`. Ohne Angabe fliegen die Stuecke einfach auseinander. */
  target?: AvatarTarget;
  /** Alle Stuecke sitzen (ohne Bewegung: sofort). */
  onAssembled?: () => void;
  /** Weggedreht und ausgeblendet. */
  onTurnedAway?: () => void;
  /** Zerfallen und angekommen — jetzt darf er aus dem Baum. */
  onScattered?: () => void;
  /** Wechselt der Wert, nickt er kurz — etwa bei jedem Schritt im Gespraech. */
  bounceKey?: string | number;
};

const PERSPECTIVE = 700;

/**
 * Der Club-Avatar: eine freundliche Figur, die sich aus kleinen Stuecken
 * zusammensetzt, einmal dreht, danach sanft schwebt, sich umschaut und
 * blinzelt. Figur, Farbe, Augen und Zubehoer waehlt man in den Einstellungen;
 * die Toene kommen aus dem Thema — er macht jede Einstellung mit.
 *
 * Wer weniger Bewegung wuenscht, sieht ihn ohne Flug, Drehen und Schweben.
 */
export function ClubAvatar({ style, ...props }: ClubAvatarProps) {
  const own = useAvatarStyle();
  const look = style ?? own;
  // Eine andere Form hat andere Stuecke — dann setzt er sich neu zusammen.
  // Die Farbe allein zeichnet nur neu.
  return <AvatarFigure key={avatarShapeKey(look)} look={look} {...props} />;
}

type FigureProps = Omit<ClubAvatarProps, 'style'> & { look: AvatarStyle };

function AvatarFigure({
  look,
  phase = 'assemble',
  size = 160,
  gazeOnly = false,
  still = false,
  target,
  onAssembled,
  onTurnedAway,
  onScattered,
  bounceKey,
}: FigureProps) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [motion] = useState(() => new AvatarMotion(theme.motion, avatarPiecesOf(look)));
  const calm = reduced === null ? null : reduced || still;

  useEffect(() => {
    motion.setHandlers({ onAssembled, onTurnedAway, onScattered });
  }, [motion, onAssembled, onTurnedAway, onScattered]);

  // Auf die Zahlen hoeren, nicht auf das Objekt: sonst liefe der Effekt bei
  // jedem Rendern, weil der Aufrufer es frisch baut.
  const targetX = target?.x;
  const targetY = target?.y;
  useEffect(() => {
    motion.setTarget(
      targetX === undefined || targetY === undefined ? undefined : { x: targetX, y: targetY },
    );
  }, [motion, targetX, targetY]);

  useEffect(() => {
    if (calm === null) return;
    motion.play(phase, calm, gazeOnly);
  }, [motion, phase, calm, gazeOnly]);

  useEffect(() => {
    if (calm === null) return;
    motion.nod(bounceKey, calm);
  }, [motion, bounceKey, calm]);

  useEffect(() => () => motion.stopAll(), [motion]);

  const colors = avatarTones(theme, look.color);
  const offset = (size - AVATAR_CANVAS) / 2;
  const turning =
    calm === false
      ? [{ perspective: PERSPECTIVE }, { rotateY: motion.rotateY }, { scale: motion.groupScale }]
      : [{ scale: motion.groupScale }];

  const layer = (name: AvatarPiece['layer']) =>
    motion.pieces
      .filter(({ piece }) => piece.layer === name)
      .map((entry) => (
        <Piece key={entry.piece.id} entry={entry} color={colors[entry.piece.tone]} />
      ));

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.frame, { width: size, height: size }]}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: motion.groupOpacity, transform: turning }]}
      >
        <Animated.View
          style={[
            styles.canvas,
            {
              left: offset,
              top: offset,
              transform: [{ scale: size / AVATAR_CANVAS }, { translateY: motion.hoverY }],
            },
          ]}
        >
          {layer('back')}
          <Animated.View
            style={[StyleSheet.absoluteFill, { transform: [{ translateX: motion.faceX }] }]}
          >
            {layer('face')}
          </Animated.View>
          {layer('spark')}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Ein Stueck. Neu gezeichnet wird es nur, wenn sich seine Farbe aendert. */
const Piece = memo(function Piece({ entry, color }: { entry: PieceMotion; color: string }) {
  const { piece } = entry;
  const [topLeft, topRight, bottomRight, bottomLeft] = piece.corners;
  // Brillenglaeser sind nur ein Rand; alles andere eine Flaeche.
  const paint = piece.outline
    ? { borderWidth: piece.outline, borderColor: color, backgroundColor: 'transparent' }
    : { backgroundColor: color };

  return (
    <Animated.View
      style={[
        styles.piece,
        paint,
        {
          left: piece.x,
          top: piece.y,
          width: piece.width,
          height: piece.height,
          borderTopLeftRadius: topLeft,
          borderTopRightRadius: topRight,
          borderBottomRightRadius: bottomRight,
          borderBottomLeftRadius: bottomLeft,
          opacity: entry.opacity,
          transform: [
            { translateX: entry.translateX },
            { translateY: entry.translateY },
            { rotate: entry.rotate },
            { scale: entry.scale },
            { scaleY: entry.scaleY },
          ],
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  frame: { pointerEvents: 'none' },
  canvas: { position: 'absolute', width: AVATAR_CANVAS, height: AVATAR_CANVAS },
  piece: { position: 'absolute' },
});
