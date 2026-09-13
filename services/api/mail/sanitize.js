/**
 * Saeubert das HTML einer Mail, bevor eine App es zu sehen bekommt.
 *
 * Von Hand gebaut und bewusst streng: das Ergebnis wird **neu geschrieben**,
 * nie durchgereicht. Erlaubt ist nur, was auf den Listen unten steht; jeder
 * Attributwert wird entschluesselt, geprueft und wieder verschluesselt, jeder
 * Text maskiert. Was sich nicht lesen laesst — ein Tag ohne Ende, ein Attribut
 * ohne schliessendes Anfuehrungszeichen —, wird als Text maskiert.
 *
 * - raus samt Inhalt: `script`, `style`, `iframe`, `object`, `svg`, `math` …
 * - raus ohne Inhalt: `form`, `button`, `input`, `link`, `meta`, `base`, `embed`
 *   und alles andere, das nicht erlaubt ist — der Text darin bleibt
 * - Attribute nur von der Liste, nie `on…`; `style` nur ohne `url(`,
 *   `expression` und `position: fixed`
 * - Links nur `http(s):`, `mailto:`, `tel:`, immer mit `target="_blank"` und
 *   `rel="noopener noreferrer"`
 * - Bilder: `cid:` zeigt auf den Anhang, `data:` nur fuer Bilder, entfernte
 *   Bilder werden gezaehlt und ohne Erlaubnis durch einen leeren Platzhalter ersetzt
 *
 * Jede Schleife laeuft linear: was bis zum Ende nicht aufgeht, beendet das Lesen.
 */
const { decodeEntities } = require('./mime.js');

/** Ein durchsichtiges GIF von 1 × 1 Pixel. */
const PLACEHOLDER_IMAGE =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
const MAX_DEPTH = 100;
const MAX_URL = 2048;
const MAX_ATTRIBUTE = 1000;
const MAX_STYLE = 4000;
const MAX_DATA_IMAGE = 400_000;

const WHITESPACE = new Set(['\t', '\n', '\f', '\r', ' ']);

const ALLOWED_TAGS = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'big',
  'blockquote',
  'br',
  'caption',
  'center',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'font',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'ins',
  'kbd',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'p',
  'pre',
  'q',
  's',
  'samp',
  'section',
  'small',
  'span',
  'strike',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'time',
  'tr',
  'tt',
  'u',
  'ul',
  'var',
  'wbr',
]);

const VOID_TAGS = new Set(['br', 'col', 'hr', 'img', 'wbr']);

/** Diese verschwinden samt allem, was bis zu ihrem End-Tag steht. */
const DROPPED_WITH_CONTENT = new Set([
  'applet',
  'audio',
  'canvas',
  'frameset',
  'iframe',
  'math',
  'noembed',
  'noframes',
  'noscript',
  'object',
  'script',
  'select',
  'style',
  'svg',
  'template',
  'textarea',
  'title',
  'video',
  'xmp',
]);

const GLOBAL_ATTRIBUTES = [
  'align',
  'bgcolor',
  'dir',
  'height',
  'lang',
  'style',
  'title',
  'valign',
  'width',
];

const TAG_ATTRIBUTES = new Map([
  ['a', ['href']],
  ['col', ['span']],
  ['colgroup', ['span']],
  ['del', ['datetime']],
  ['details', ['open']],
  ['font', ['color', 'face', 'size']],
  ['hr', ['color', 'noshade', 'size']],
  ['img', ['alt', 'border', 'hspace', 'vspace']],
  ['ins', ['datetime']],
  ['li', ['type', 'value']],
  ['ol', ['reversed', 'start', 'type']],
  ['table', ['border', 'cellpadding', 'cellspacing']],
  ['td', ['colspan', 'nowrap', 'rowspan']],
  ['th', ['colspan', 'nowrap', 'rowspan', 'scope']],
  ['time', ['datetime']],
  ['ul', ['type']],
]);

const CSS_PROPERTY = /^-?[a-z][a-z0-9-]{0,60}$/;
const CSS_VALUE = /^[\w\s#%.,()'"!/+*:-]*$/;
const SAFE_CSS_FUNCTIONS = new Set([
  '(',
  'rgb(',
  'rgba(',
  'hsl(',
  'hsla(',
  'calc(',
  'min(',
  'max(',
  'clamp(',
]);
const BLOCKED_CSS_PROPERTIES = new Set(['behavior', '-moz-binding']);

const TAG_NAME = /[A-Za-z][^\t\n\f\r />]*/y;
const TEXT_UNSAFE = /[<>]|&(?!(?:[A-Za-z][A-Za-z0-9]{0,31}|#[0-9]{1,7}|#[xX][0-9A-Fa-f]{1,6});)/g;
const ATTRIBUTE_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const isLetter = (char) => /^[A-Za-z]$/.test(char ?? '');

// ------------------------------------------------------------------ Maskieren

/** `<` und `>` immer; `&` nur, wenn keine vollstaendige Entitaet folgt. */
function escapeText(text) {
  return text.replace(TEXT_UNSAFE, (char) =>
    char === '<' ? '&lt;' : char === '>' ? '&gt;' : '&amp;',
  );
}

const escapeAttribute = (value) => value.replace(/[&<>"']/g, (char) => ATTRIBUTE_ESCAPES[char]);

/** Wie der Browser eine URL liest: Tab und Zeilenumbruch fallen weg, Steuerzeichen am Rand auch. */
function compactUrl(value) {
  const text = value.replace(/[\t\n\r]/g, '');
  let start = 0;
  let end = text.length;
  while (start < end && text.charCodeAt(start) <= 0x20) start += 1;
  while (end > start && text.charCodeAt(end - 1) <= 0x20) end -= 1;
  return text.slice(start, end);
}

// ------------------------------------------------------------------ Attribute

function cleanLink(value) {
  if (value.length > MAX_URL * 2) return null;
  const url = compactUrl(value);
  return url.length <= MAX_URL && /^(?:https?:|mailto:|tel:)/i.test(url) ? url : null;
}

function cleanStyle(value) {
  if (value.length > MAX_STYLE || /[\\<>@&]|\/\*/.test(value)) return null;
  const kept = [];
  for (const declaration of value.split(';')) {
    const colon = declaration.indexOf(':');
    if (colon === -1) continue;
    const property = declaration.slice(0, colon).trim().toLowerCase();
    const body = declaration.slice(colon + 1).trim();
    if (!CSS_PROPERTY.test(property) || body.length === 0 || !CSS_VALUE.test(body)) continue;
    if (BLOCKED_CSS_PROPERTIES.has(property)) continue;
    const compact = body.toLowerCase().replace(/\s+/g, '');
    const position = compact.replace(/!important$/, '');
    if (property === 'position' && position !== 'static' && position !== 'relative') continue;
    if (/expression|javascript:|vbscript:/.test(compact)) continue;
    // Keine Funktion ausser Farben und Rechnen: so kommt weder url() noch image-set() durch.
    if ((compact.match(/[a-z-]*\(/g) ?? []).some((name) => !SAFE_CSS_FUNCTIONS.has(name))) continue;
    kept.push(`${property}: ${body}`);
  }
  return kept.length > 0 ? kept.join('; ') : null;
}

/** Die erlaubten Attribute eines Tags, entschluesselt und geprueft; das erste gewinnt. */
function pickAttributes(tag) {
  const allowed = new Set([...GLOBAL_ATTRIBUTES, ...(TAG_ATTRIBUTES.get(tag.name) ?? [])]);
  const seen = new Set();
  const picked = [];
  for (const [name, raw] of tag.attributes) {
    if (seen.has(name)) continue;
    seen.add(name);
    if (!allowed.has(name)) continue;
    const value = decodeEntities(raw);
    const clean =
      name === 'style'
        ? cleanStyle(value)
        : name === 'href'
          ? cleanLink(value)
          : value.length <= MAX_ATTRIBUTE
            ? value
            : null;
    if (clean !== null) picked.push([name, clean]);
  }
  if (tag.name === 'a' && picked.some(([name]) => name === 'href')) {
    picked.push(['target', '_blank'], ['rel', 'noopener noreferrer']);
  }
  return picked;
}

function decodeCid(value) {
  let text = value;
  try {
    text = decodeURIComponent(value);
  } catch {
    // Kaputte Prozentzeichen: dann eben so, wie es dasteht.
  }
  return text.replace(/^<|>$/g, '').trim();
}

/** Wohin ein Bild zeigen darf. `blocked`: ein entferntes Bild, das ersetzt wurde. */
function imageSource(value, state) {
  const url = compactUrl(value.length > MAX_DATA_IMAGE ? '' : value);
  const head = url.slice(0, 10).toLowerCase();
  if (head.startsWith('cid:')) {
    const found = state.resolveCid(decodeCid(url.slice(4)));
    if (!found) return { src: PLACEHOLDER_IMAGE, blocked: false };
    state.inline.add(found.index);
    return { src: found.url, blocked: false };
  }
  if (head.startsWith('http://') || head.startsWith('https://') || head.startsWith('//')) {
    state.remoteImages += 1;
    const absolute = head.startsWith('//') ? `https:${url}` : url;
    if (state.allowRemoteImages && absolute.length <= MAX_URL) {
      return { src: absolute, blocked: false };
    }
    return { src: PLACEHOLDER_IMAGE, blocked: true };
  }
  if (/^data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=\s]*$/i.test(url)) {
    return { src: url.replace(/\s+/g, ''), blocked: false };
  }
  return { src: PLACEHOLDER_IMAGE, blocked: false };
}

/** Ein Bild ohne `src` zeigt nichts und faellt weg. */
function imageAttributes(tag, state) {
  const source = tag.attributes.find(([name]) => name === 'src');
  if (!source) return null;
  const image = imageSource(decodeEntities(source[1]), state);
  return [
    ['src', image.src],
    ...pickAttributes(tag),
    ...(image.blocked ? [['data-remote-image', '1']] : []),
  ];
}

// ------------------------------------------------------------------ Lesen

/**
 * Liest ein Tag ab dem ersten Buchstaben seines Namens, so wie der Tokenizer
 * eines Browsers. `null`: das Tag geht bis zum Ende nicht auf.
 */
function readTag(source, from) {
  TAG_NAME.lastIndex = from;
  const match = TAG_NAME.exec(source);
  if (!match) return null;
  const attributes = [];
  const length = source.length;
  let i = from + match[0].length;
  while (i < length) {
    const char = source[i];
    if (WHITESPACE.has(char) || char === '/') {
      i += 1;
      continue;
    }
    if (char === '>') return { name: match[0].toLowerCase(), attributes, end: i + 1 };
    const nameStart = i;
    i += 1;
    while (i < length && !WHITESPACE.has(source[i]) && !'/>='.includes(source[i])) i += 1;
    const name = source.slice(nameStart, i).toLowerCase();
    while (i < length && WHITESPACE.has(source[i])) i += 1;
    let value = '';
    if (source[i] === '=') {
      i += 1;
      while (i < length && WHITESPACE.has(source[i])) i += 1;
      const quote = source[i];
      if (quote === '"' || quote === "'") {
        const close = source.indexOf(quote, i + 1);
        if (close === -1) return null;
        value = source.slice(i + 1, close);
        i = close + 1;
      } else {
        const valueStart = i;
        while (i < length && !WHITESPACE.has(source[i]) && source[i] !== '>') i += 1;
        value = source.slice(valueStart, i);
      }
    }
    attributes.push([name, value]);
  }
  return null;
}

function openTag(state, tag) {
  if (!ALLOWED_TAGS.has(tag.name)) return;
  const isVoid = VOID_TAGS.has(tag.name);
  if (!isVoid && state.stack.length >= MAX_DEPTH) return;
  const attributes = tag.name === 'img' ? imageAttributes(tag, state) : pickAttributes(tag);
  if (attributes === null) return;
  const written = attributes.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`);
  state.out.push(`<${tag.name}${written.join('')}>`);
  if (!isVoid) state.stack.push(tag.name);
}

/** Schliesst bis zum passenden offenen Tag; ein End-Tag ohne Anfang faellt weg. */
function closeTag(state, name) {
  if (name === 'br') {
    state.out.push('<br>');
    return;
  }
  const index = state.stack.lastIndexOf(name);
  if (index === -1) return;
  while (state.stack.length > index) state.out.push(`</${state.stack.pop()}>`);
}

/** Springt hinter das End-Tag eines Elements, das samt Inhalt wegfaellt. */
function skipElement(source, tag) {
  const closer = new RegExp(`</${tag.name}[\\t\\n\\f\\r />]`, 'gi');
  closer.lastIndex = tag.end;
  const match = closer.exec(source);
  if (!match) return source.length;
  const end = source.indexOf('>', match.index);
  return end === -1 ? source.length : end + 1;
}

/** Was mit einem `<` beginnt: Kommentar, Tag, End-Tag — oder nur ein Zeichen im Text. */
function markup(source, open, state) {
  const escapeRest = () => {
    state.out.push(escapeText(source.slice(open)));
    return source.length;
  };
  const skipTo = (from) => {
    const end = source.indexOf('>', from);
    return end === -1 ? source.length : end + 1;
  };
  if (source.startsWith('<!--', open)) {
    if (source.startsWith('<!-->', open)) return open + 5;
    if (source.startsWith('<!--->', open)) return open + 6;
    const end = source.indexOf('-->', open + 4);
    return end === -1 ? source.length : end + 3;
  }
  const next = source[open + 1];
  if (next === '!' || next === '?') return skipTo(open + 2);
  if (next === '/') {
    const after = source[open + 2];
    if (after === '>') return open + 3;
    if (!isLetter(after)) return skipTo(open + 2);
    const tag = readTag(source, open + 2);
    if (!tag) return escapeRest();
    closeTag(state, tag.name);
    return tag.end;
  }
  if (!isLetter(next)) {
    state.out.push('&lt;');
    return open + 1;
  }
  const tag = readTag(source, open + 1);
  if (!tag) return escapeRest();
  if (DROPPED_WITH_CONTENT.has(tag.name)) return skipElement(source, tag);
  openTag(state, tag);
  return tag.end;
}

/**
 * Saeubert `input`.
 * `allowRemoteImages`: entfernte Bilder laden lassen (gezaehlt werden sie immer).
 * `resolveCid(cid)`: `{ index, url }` des Anhangs mit dieser Content-ID oder `null`.
 * Zurueck: `{ html, remoteImages, inlineAttachments }` — die Nummern der Anhaenge,
 * die als eingebettete Bilder im HTML stehen.
 */
function sanitizeHtml(input, { allowRemoteImages = false, resolveCid = () => null } = {}) {
  const source = String(input ?? '').replace(/\0/g, '');
  const state = {
    out: [],
    stack: [],
    remoteImages: 0,
    inline: new Set(),
    allowRemoteImages: allowRemoteImages === true,
    resolveCid,
  };
  let cursor = 0;
  while (cursor < source.length) {
    const open = source.indexOf('<', cursor);
    if (open === -1) {
      state.out.push(escapeText(source.slice(cursor)));
      break;
    }
    if (open > cursor) state.out.push(escapeText(source.slice(cursor, open)));
    cursor = markup(source, open, state);
  }
  while (state.stack.length > 0) state.out.push(`</${state.stack.pop()}>`);
  return {
    html: state.out.join(''),
    remoteImages: state.remoteImages,
    inlineAttachments: [...state.inline].sort((a, b) => a - b),
  };
}

module.exports = { PLACEHOLDER_IMAGE, sanitizeHtml };
