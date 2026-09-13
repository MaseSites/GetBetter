/**
 * Das gesaeuberte HTML einer Mail als eigenes Dokument fuer ein `iframe` im
 * Browser. Der Rahmen laeuft ohne Skripte und ohne eigene Herkunft — deshalb
 * kann die App seine Hoehe nicht messen und schaetzt sie aus dem Text.
 */

export type MailDocumentStyle = {
  text: string;
  muted: string;
  link: string;
  background: string;
  border: string;
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  /** Einzug eines Zitats. */
  indent: number;
};

/** Nur Bilder und Stile; keine Skripte, keine Verbindungen, keine Formulare. */
const CONTENT_POLICY =
  "default-src 'none'; img-src data: http: https:; style-src 'unsafe-inline'; font-src data:";

function css(style: MailDocumentStyle): string {
  return [
    `html,body{margin:0;padding:0;background:${style.background};color:${style.text};}`,
    `body{font-family:${style.fontFamily};font-size:${style.fontSize}px;line-height:${style.lineHeight}px;overflow-wrap:anywhere;word-break:break-word;-webkit-text-size-adjust:100%;}`,
    'img,video{max-width:100%;height:auto;}',
    'table{max-width:100%;}',
    'pre{white-space:pre-wrap;}',
    `a{color:${style.link};}`,
    `blockquote{margin:0 0 0 ${style.indent}px;padding-left:${style.indent}px;border-left:1px solid ${style.border};color:${style.muted};}`,
    // Blockierte Bilder sind leere Platzhalter — sie sollen kein Loch reissen.
    'img[data-remote-image]{display:none;}',
  ].join('');
}

export function mailDocument(html: string, style: MailDocumentStyle): string {
  return [
    '<!doctype html><html><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="${CONTENT_POLICY}">`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    '<base target="_blank">',
    `<style>${css(style)}</style>`,
    '</head><body>',
    html,
    '</body></html>',
  ].join('');
}

export const MIN_BODY_HEIGHT = 120;
export const MAX_BODY_HEIGHT = 6000;
/** So breit ist ein Zeichen im Schnitt, gemessen an der Schriftgroesse. */
const CHAR_WIDTH_SHARE = 0.5;
/** Ein Bild ohne Hoehenangabe nimmt so viel der Breite als Hoehe an. */
const IMAGE_SHARE = 0.6;
/** Kleinere Bilder sind Zaehlpixel oder Abstandhalter. */
const TINY_IMAGE = 10;

function imageHeights(html: string, width: number): number[] {
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  return tags.flatMap((tag) => {
    if (/data-remote-image/i.test(tag)) return [];
    const sizes = [...tag.matchAll(/\b(width|height)\s*=\s*["']?(\d+)/gi)];
    if (sizes.some((match) => Number(match[2]) < TINY_IMAGE)) return [];
    const height = sizes.find((match) => match[1]?.toLowerCase() === 'height');
    return [height ? Number(height[2]) : width * IMAGE_SHARE];
  });
}

/**
 * Wie hoch der Rahmen sein muss: Zeilen des Textes bei dieser Breite plus die
 * Bilder. Lieber etwas zu hoch — reicht es nicht, rollt der Rahmen selbst.
 */
export function estimateBodyHeight(input: {
  text: string;
  html: string;
  width: number;
  fontSize: number;
  lineHeight: number;
}): number {
  const width = Math.max(input.width, 1);
  const perLine = Math.max(1, Math.floor(width / (input.fontSize * CHAR_WIDTH_SHARE)));
  const lines = input.text
    .split(/\r?\n/)
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
  const images = imageHeights(input.html, width).reduce((sum, height) => sum + height, 0);
  const raw = lines * input.lineHeight + images + input.lineHeight * 2;
  return Math.round(Math.min(MAX_BODY_HEIGHT, Math.max(MIN_BODY_HEIGHT, raw)));
}
