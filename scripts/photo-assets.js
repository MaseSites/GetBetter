/**
 * Holt die dokumentierten Pexels-Fotos und baut daraus die kleinen Bildmarken
 * der Better-Apps sowie den transparent auslaufenden GetBetter-Hintergrund.
 *
 *   node scripts/photo-assets.js
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const CORE = path.join(ROOT, 'packages', 'core', 'src', 'assets');

const PHOTOS = [
  {
    id: 'betterfamily',
    position: 'attention',
    url: 'https://images.pexels.com/photos/33187086/pexels-photo-33187086.jpeg?cs=srgb&fm=jpg&w=1600',
  },
  {
    id: 'bettergym',
    position: 'attention',
    url: 'https://images.pexels.com/photos/6796970/pexels-photo-6796970.jpeg?cs=srgb&fm=jpg&w=1600',
  },
  {
    id: 'betterai',
    position: 'right',
    url: 'https://images.pexels.com/photos/3845162/pexels-photo-3845162.jpeg?cs=srgb&fm=jpg&w=1600',
  },
  {
    id: 'bettermoney',
    position: 'attention',
    url: 'https://images.pexels.com/photos/5550904/pexels-photo-5550904.jpeg?cs=srgb&fm=jpg&w=1600',
  },
];

const MOUNTAINS =
  'https://images.pexels.com/photos/29034987/pexels-photo-29034987.jpeg?cs=srgb&fm=jpg&w=1600';

async function download(url) {
  const response = await fetch(url);
  if (!response.ok)
    throw new Error(`Foto konnte nicht geladen werden (${response.status}): ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function atomicToFile(pipeline, target) {
  const temporary = `${target}.${process.pid}.new`;
  await pipeline.toFile(temporary);
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      await fs.promises.rename(temporary, target);
      return;
    } catch (error) {
      const retryable = ['EBUSY', 'EACCES', 'EPERM', 'EINVAL'].includes(error.code);
      if (!retryable || attempt === 11) {
        await fs.promises.rm(temporary, { force: true });
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
}

async function roundedTile(input, size, radius, position) {
  const image = await sharp(input)
    .resize(size, size, { fit: 'cover', position })
    .modulate({ saturation: 0.86 })
    .png()
    .toBuffer();
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" fill="white"/></svg>`,
  );
  return sharp(image)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9, palette: true, quality: 90, colours: 256, dither: 0.6 })
    .toBuffer();
}

async function writeAppBackdrop(input, id, position) {
  const image = await sharp(input)
    .resize(780, 980, { fit: 'cover', position })
    .modulate({ saturation: 0.56, brightness: 0.9 })
    .blur(2.2)
    .png()
    .toBuffer();
  const mask = Buffer.from(`<svg width="780" height="980">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="white" stop-opacity="0"/>
      <stop offset="0.22" stop-color="white" stop-opacity="0.03"/>
      <stop offset="0.45" stop-color="white" stop-opacity="0.18"/>
      <stop offset="0.75" stop-color="white" stop-opacity="0.44"/>
      <stop offset="1" stop-color="white" stop-opacity="0.68"/>
    </linearGradient></defs>
    <rect width="780" height="980" fill="url(#fade)"/>
  </svg>`);

  await atomicToFile(
    sharp(image)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png({ compressionLevel: 9, palette: true, quality: 90, colours: 256, dither: 0.5 }),
    path.join(CORE, 'backgrounds', `${id}-life.png`),
  );
}

async function writeAppPhoto({ id, position, url }) {
  const input = await download(url);
  const appAssets = path.join(ROOT, 'apps', id, 'assets');
  fs.mkdirSync(appAssets, { recursive: true });

  const square = (size) =>
    sharp(input)
      .resize(size, size, { fit: 'cover', position })
      .modulate({ saturation: 0.86 })
      .png({ compressionLevel: 9, palette: true, quality: 90, colours: 256, dither: 0.6 });

  await atomicToFile(square(512), path.join(CORE, 'apps', `${id}.png`));
  await atomicToFile(square(1024), path.join(appAssets, 'icon.png'));
  await atomicToFile(square(1024), path.join(appAssets, 'android-icon-background.png'));
  await atomicToFile(square(64), path.join(appAssets, 'favicon.png'));

  const splashTile = await roundedTile(input, 680, 150, position);
  await atomicToFile(
    sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: splashTile, left: 172, top: 172 }])
      .png({ compressionLevel: 9, palette: true, quality: 90, colours: 256, dither: 0.6 }),
    path.join(appAssets, 'splash-icon.png'),
  );

  await writeAppBackdrop(input, id, position);
}

async function writeMountainBackdrop() {
  const input = await download(MOUNTAINS);
  const metadata = await sharp(input).metadata();
  if (!metadata.width || !metadata.height) throw new Error('Bergfoto hat keine lesbare Groesse.');
  // Der obere Ausschnitt zeigt die Gipfel schon hinter der App-Ueberschrift;
  // die kontrastreiche Waldkante landet erst hinter den unteren Kennzahlen.
  const cropHeight = Math.round(metadata.height * 0.58);
  const cropWidth = Math.round(cropHeight * (780 / 980));
  const cropLeft = Math.max(0, Math.round((metadata.width - cropWidth) / 2));
  const image = await sharp(input)
    .extract({ left: cropLeft, top: 0, width: cropWidth, height: cropHeight })
    .resize(780, 980)
    .modulate({ saturation: 0.5, brightness: 0.88 })
    .blur(1.2)
    .png()
    .toBuffer();
  const mask = Buffer.from(`<svg width="780" height="980">
    <defs><linearGradient id="fade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="white" stop-opacity="0"/>
      <stop offset="0.12" stop-color="white" stop-opacity="0.08"/>
      <stop offset="0.28" stop-color="white" stop-opacity="0.24"/>
      <stop offset="0.55" stop-color="white" stop-opacity="0.56"/>
      <stop offset="1" stop-color="white" stop-opacity="0.9"/>
    </linearGradient></defs>
    <rect width="780" height="980" fill="url(#fade)"/>
  </svg>`);

  await atomicToFile(
    sharp(image)
      .composite([{ input: mask, blend: 'dest-in' }])
      .png({ compressionLevel: 9, palette: true, quality: 92, colours: 256, dither: 0.5 }),
    path.join(CORE, 'backgrounds', 'getbetter-life.png'),
  );
}

async function main() {
  // Sequenziell schreiben: Unter Windows koennen mehrere laufende Metro-Server
  // sonst dieselben Asset-Verzeichnisse waehrend des Schreibens kurz sperren.
  for (const photo of PHOTOS) await writeAppPhoto(photo);
  await writeMountainBackdrop();
  process.stdout.write('Vier Foto-Icons, vier App-Hintergruende und ein Bergnebel geschrieben.\n');
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
