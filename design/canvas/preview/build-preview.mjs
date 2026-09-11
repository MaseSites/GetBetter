// Baut aus den .dc.html-Artboards eine einfache Vorschauseite, damit man sie
// im Browser wirklich anschauen kann. Nur zum Prüfen, nicht Teil der Abgabe.
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..');

const files = readdirSync(src).filter((f) => f.endsWith('.dc.html')).sort();

const frames = files.map((f) => {
  const raw = readFileSync(join(src, f), 'utf8');
  const helmet = raw.match(/<helmet>([\s\S]*?)<\/helmet>/)?.[1] ?? '';
  const body = raw
    .replace(/[\s\S]*?<x-dc>/, '')
    .replace(/<\/x-dc>[\s\S]*/, '')
    .replace(/<helmet>[\s\S]*?<\/helmet>/, '');
  const doc = `<!doctype html><html lang="de"><head><meta charset="utf-8">${helmet}</head><body>${body}</body></html>`;
  writeFileSync(join(here, f.replace('.dc.html', '.html')), doc);
  return { name: f.replace('.dc.html', ''), file: f.replace('.dc.html', '.html') };
});

const index = `<!doctype html><html lang="de"><head><meta charset="utf-8">
<title>GetBetter — Vorschau</title>
<style>
  body{margin:0;background:#E8E6DF;font:14px/1.4 system-ui,sans-serif;padding:28px}
  h1{font-size:15px;letter-spacing:.1em;text-transform:uppercase;margin:0 0 20px;color:#55574C}
  .row{display:flex;gap:26px;flex-wrap:wrap;align-items:flex-start}
  figure{margin:0}
  figcaption{font-size:12px;font-weight:600;color:#55574C;margin-bottom:7px}
  iframe{border:0;background:#fff;border-radius:20px;box-shadow:0 12px 30px -16px rgba(0,0,0,.4)}
</style></head><body>
<h1>GetBetter — Artboard-Vorschau</h1>
<div class="row">
${frames
  .map((f) => {
    const wide = f.name === 'Fundament' || f.name === 'Zustaende';
    const w = f.name === 'Fundament' ? 960 : f.name === 'Zustaende' ? 1300 : 390;
    const h = f.name === 'Fundament' ? 2680 : f.name === 'Zustaende' ? 1300 : 844;
    return `<figure${wide ? ' style="flex:1 0 100%"' : ''}><figcaption>${f.name}</figcaption><iframe src="${f.file}" width="${w}" height="${h}" loading="lazy"></iframe></figure>`;
  })
  .join('\n')}
</div>
</body></html>`;

writeFileSync(join(here, 'index.html'), index);
console.log(`preview: ${frames.length} artboards`);
