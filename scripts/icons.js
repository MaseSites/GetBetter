/**
 * Erzeugt alle Bilder der Better-Apps aus dem, was im Code steht.
 *
 *   node scripts/icons.js
 *
 * - je Funktion ein Logo (256 px) in Farbe und in Grau
 *   → packages/core/src/assets/modules/<id>.png, <id>-mono.png
 * - je App das Store-Icon, die Android-Ebenen, das Splash-Bild und das Favicon
 *   → apps/<app>/assets/
 *
 * Die Wahrheit ueber Farben und Symbole bleibt im Code (theme/modules.ts,
 * mocks/modules.ts, ui/Icon.tsx, app/identity.ts); das Skript liest sie dort
 * heraus, damit nichts doppelt gepflegt werden muss. Die Symbole kommen aus
 * dem Ionicons-Paket (MIT).
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'packages', 'core', 'src');
const IONICONS = path.join(ROOT, 'node_modules', 'ionicons', 'dist', 'svg');

const read = (relative) => fs.readFileSync(path.join(CORE, relative), 'utf8');

// ------------------------------------------------------------ Code lesen

/** IconName → Ionicons-Datei, aus ui/Icon.tsx. */
function iconNames() {
  const map = {};
  for (const match of read('ui/Icon.tsx').matchAll(/^\s+(\w+): '([\w-]+)',$/gm)) {
    map[match[1]] = match[2];
  }
  return map;
}

/** Modul-Id → IconName, aus mocks/modules.ts. */
function moduleIcons() {
  const map = {};
  const source = read('mocks/modules.ts');
  for (const match of source.matchAll(/id: '(\w+)',[\s\S]*?icon: '(\w+)',/g)) {
    map[match[1]] = match[2];
  }
  return map;
}

/** Farben aus theme/modules.ts: HUES und MODULE_HUE. */
function colours() {
  const source = read('theme/modules.ts');
  const hues = {};
  for (const match of source.matchAll(
    /^\s+(\w+): \{ light: \['(#[0-9A-Fa-f]{6})', '(#[0-9A-Fa-f]{6})'\], dark: \[/gm,
  )) {
    hues[match[1]] = [match[2], match[3]];
  }
  const moduleHue = {};
  const block = source.slice(
    source.indexOf('const MODULE_HUE'),
    source.indexOf('};', source.indexOf('const MODULE_HUE')),
  );
  for (const match of block.matchAll(/^\s+(\w+): '(\w+)',$/gm)) {
    moduleHue[match[1]] = match[2];
  }
  return { hues, moduleHue };
}

/** Die Apps aus app/identity.ts: Id, Farbe, Symbol. */
function apps() {
  const source = read('app/identity.ts');
  const list = [];
  for (const match of source.matchAll(
    /id: '(\w+)',\s+name: '(\w+)',[\s\S]*?hue: '(\w+)',\s+icon: '(\w+)',/g,
  )) {
    list.push({ id: match[1], name: match[2], hue: match[3], icon: match[4] });
  }
  return list;
}

// ------------------------------------------------------------ Zeichnen

/** Das Symbol aus Ionicons, weiss eingefaerbt, als SVG-Fragment. */
function glyph(ioniconName) {
  const file = path.join(IONICONS, `${ioniconName}.svg`);
  const raw = fs.readFileSync(file, 'utf8');
  const inner = raw.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  // `fill` erbt an alles ohne eigenes fill, `color` bedient currentColor der Striche.
  return `<g fill="#FFFFFF" color="#FFFFFF">${inner}</g>`;
}

/**
 * Ein Logo: abgerundetes Quadrat mit Verlauf, ein Lichtbogen, das Symbol.
 * `scale` sagt, wie gross das Symbol im Quadrat ist; Store-Icons brauchen
 * etwas mehr Rand als die kleinen Logos.
 */
function logoSvg({ size, from, to, ioniconName, radius, scale, transparent = false }) {
  const inset = (size * (1 - scale)) / 2;
  const box = size * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <clipPath id="c"><rect width="${size}" height="${size}" rx="${radius}"/></clipPath>
  </defs>
  ${transparent ? '' : `<rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>`}
  ${
    transparent
      ? ''
      : `<ellipse clip-path="url(#c)" cx="${size * 0.3}" cy="${-size * 0.12}" rx="${size * 0.72}" ry="${size * 0.6}" fill="#FFFFFF" fill-opacity="0.16"/>`
  }
  <svg x="${inset}" y="${inset}" width="${box}" height="${box}" viewBox="0 0 512 512">${glyph(ioniconName)}</svg>
</svg>`;
}

/** Nur die Flaeche mit Verlauf — Android legt das Symbol selbst darueber. */
function backgroundSvg(size, from, to) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs>
  <rect width="${size}" height="${size}" fill="url(#g)"/>
</svg>`;
}

async function png(svg, target) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  await sharp(Buffer.from(svg)).png().toFile(target);
}

// ------------------------------------------------------------ Ablauf

async function main() {
  const names = iconNames();
  const modules = moduleIcons();
  const { hues, moduleHue } = colours();
  const grey = ['#6B6B66', '#3C3C38'];

  let count = 0;

  // Der Haushalt ist keine Funktion im Register, braucht aber ein Logo.
  modules.household = 'people';
  moduleHue.household = 'amber';

  // Die Logos der Funktionen
  for (const [id, iconName] of Object.entries(modules)) {
    const ioniconName = names[iconName];
    if (!ioniconName) throw new Error(`Kein Ionicon fuer "${iconName}" (${id})`);
    const [from, to] = hues[moduleHue[id]] ?? hues.slate;
    const out = path.join(CORE, 'assets', 'modules');
    await png(
      logoSvg({ size: 256, from, to, ioniconName, radius: 58, scale: 0.5 }),
      path.join(out, `${id}.png`),
    );
    await png(
      logoSvg({ size: 256, from: grey[0], to: grey[1], ioniconName, radius: 58, scale: 0.5 }),
      path.join(out, `${id}-mono.png`),
    );
    count += 2;
  }

  // Die Apps: Store-Icon, Android-Ebenen, Splash, Favicon
  for (const app of apps()) {
    const [from, to] = hues[app.hue] ?? hues.slate;
    const ioniconName = names[app.icon];
    if (!ioniconName) throw new Error(`Kein Ionicon fuer App ${app.id}`);
    const out = path.join(ROOT, 'apps', app.id, 'assets');

    await png(
      logoSvg({ size: 1024, from, to, ioniconName, radius: 224, scale: 0.5 }),
      path.join(out, 'icon.png'),
    );
    // Android legt die Ebenen selbst uebereinander und rundet selbst.
    await png(
      logoSvg({ size: 1024, from, to, ioniconName, radius: 0, scale: 0.38, transparent: true }),
      path.join(out, 'android-icon-foreground.png'),
    );
    await png(backgroundSvg(1024, from, to), path.join(out, 'android-icon-background.png'));
    await png(
      logoSvg({
        size: 1024,
        from: '#FFFFFF',
        to: '#FFFFFF',
        ioniconName,
        radius: 0,
        scale: 0.38,
        transparent: true,
      }),
      path.join(out, 'android-icon-monochrome.png'),
    );
    await png(
      logoSvg({ size: 1024, from, to, ioniconName, radius: 0, scale: 0.34, transparent: true }),
      path.join(out, 'splash-icon.png'),
    );
    await png(
      logoSvg({ size: 64, from, to, ioniconName, radius: 14, scale: 0.5 }),
      path.join(out, 'favicon.png'),
    );

    // Dasselbe Logo noch einmal klein im Kern: fuer die Startseite und die
    // Karten der anderen Apps in GetBetter.
    const shared = path.join(CORE, 'assets', 'apps');
    await png(
      logoSvg({ size: 256, from, to, ioniconName, radius: 58, scale: 0.5 }),
      path.join(shared, `${app.id}.png`),
    );
    await png(
      logoSvg({ size: 256, from: grey[0], to: grey[1], ioniconName, radius: 58, scale: 0.5 }),
      path.join(shared, `${app.id}-mono.png`),
    );
    count += 8;
  }

  // Die Tabelle, ueber die die App ihre Logos findet — Metro braucht
  // feste require()-Pfade, deshalb wird sie mitgeschrieben.
  const ids = Object.keys(modules).sort();
  const appIds = apps().map((app) => app.id);
  const lines = [
    '/* Von scripts/icons.js erzeugt — nicht von Hand aendern. */',
    "import type { ImageSourcePropType } from 'react-native';",
    '',
    'export const MODULE_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {',
    ...ids.map((id) => `  ${id}: require('./modules/${id}.png'),`),
    '};',
    '',
    'export const MODULE_IMAGES_MONO: Readonly<Record<string, ImageSourcePropType>> = {',
    ...ids.map((id) => `  ${id}: require('./modules/${id}-mono.png'),`),
    '};',
    '',
    'export const APP_IMAGES: Readonly<Record<string, ImageSourcePropType>> = {',
    ...appIds.map((id) => `  ${id}: require('./apps/${id}.png'),`),
    '};',
    '',
    'export const APP_IMAGES_MONO: Readonly<Record<string, ImageSourcePropType>> = {',
    ...appIds.map((id) => `  ${id}: require('./apps/${id}-mono.png'),`),
    '};',
    '',
  ];
  fs.writeFileSync(path.join(CORE, 'assets', 'index.ts'), lines.join('\n'), 'utf8');

  process.stdout.write(`${count} Bilder und die Tabelle geschrieben.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
