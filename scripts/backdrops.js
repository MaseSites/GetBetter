/**
 * Erzeugt die ruhigen Hintergruende, die man unter Aussehen waehlen kann —
 * ohne Fotos und ohne Downloads: jedes Bild ist ein SVG aus Verlaeufen,
 * unscharfen Flaechen und Silhouetten, das sharp zu JPEG macht.
 *
 *   node scripts/backdrops.js
 *
 * → packages/core/src/assets/backgrounds/<key>.jpg         1080 × 1920
 * → packages/core/src/assets/backgrounds/<key>-thumb.jpg    288 × 512, fuer die Auswahl
 *
 * Der Zufall kommt aus festen Samen: zweimal laufen lassen gibt dieselben
 * Bilder. Die Schluessel muessen zu `BACKDROPS` in theme/backdrops.ts passen.
 * Jedes Bild hat oben Himmel oder Nebel und unten das Motiv — die App legt
 * oben mehr Papier darueber, damit Schrift dort lesbar bleibt.
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'packages', 'core', 'src', 'assets', 'backgrounds');

const W = 1080;
const H = 1920;
/** Silhouetten ragen seitlich hinaus, damit die Unschaerfe keine Kante zeigt. */
const OVER = 60;
const THUMB = { width: 288, height: 512 };
/** Korn in Tonwertstufen: genug gegen Stufen im Verlauf, zu wenig, um es zu sehen. */
const GRAIN = 4;
const QUALITY = 84;

// ------------------------------------------------------------ Werkzeuge

/** Kleiner, fester Zufall (mulberry32). */
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value) => Math.round(value * 10) / 10;

/** Sammelt Definitionen und Zeichnung und gibt am Ende das SVG heraus. */
function canvas() {
  const defs = [];
  const body = [];
  let counter = 0;
  const id = (prefix) => `${prefix}${(counter += 1)}`;

  return {
    add: (markup) => body.push(markup),
    /** Ein Unschaerfe-Filter ueber die ganze Flaeche; gibt das Attribut zurueck. */
    blur(deviation) {
      if (!deviation) return '';
      const name = id('b');
      defs.push(
        `<filter id="${name}" filterUnits="userSpaceOnUse" x="${-OVER * 4}" y="${-OVER * 4}" width="${W + OVER * 8}" height="${H + OVER * 8}" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${deviation}"/></filter>`,
      );
      return ` filter="url(#${name})"`;
    },
    /** Senkrechter Verlauf in Bildkoordinaten; `stops` als [Anteil, Farbe, Deckkraft]. */
    vertical(stops, from = 0, to = H) {
      const name = id('v');
      defs.push(
        `<linearGradient id="${name}" gradientUnits="userSpaceOnUse" x1="0" y1="${round(from)}" x2="0" y2="${round(to)}">${stops
          .map(
            ([offset, color, opacity = 1]) =>
              `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`,
          )
          .join('')}</linearGradient>`,
      );
      return `url(#${name})`;
    },
    /** Senkrechter Verlauf je Form (fuer schmale Streifen). */
    boxVertical(stops) {
      const name = id('s');
      defs.push(
        `<linearGradient id="${name}" x1="0" y1="1" x2="0" y2="0">${stops
          .map(
            ([offset, color, opacity = 1]) =>
              `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`,
          )
          .join('')}</linearGradient>`,
      );
      return `url(#${name})`;
    },
    radial(cx, cy, r, color, opacity) {
      const name = id('r');
      defs.push(
        `<radialGradient id="${name}" gradientUnits="userSpaceOnUse" cx="${round(cx)}" cy="${round(cy)}" r="${round(r)}"><stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/><stop offset="0.45" stop-color="${color}" stop-opacity="${round(opacity * 0.45 * 100) / 100}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`,
      );
      return `url(#${name})`;
    },
    svg: () =>
      `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join('')}</defs>${body.join('')}</svg>`,
  };
}

/** Eine Silhouette aus Hoehen, die gleichmaessig ueber die Breite verteilt sind. */
function silhouette(heights, bottom = H + OVER) {
  const left = -OVER;
  const right = W + OVER;
  const last = heights.length - 1;
  const line = heights
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${round(left + ((right - left) * i) / last)} ${round(y)}`)
    .join('');
  return `${line}L${right} ${bottom}L${left} ${bottom}Z`;
}

/** Nur die Kante oben — fuer Lichtsaeume auf Kaemmen. */
function crest(heights) {
  const left = -OVER;
  const right = W + OVER;
  const last = heights.length - 1;
  return heights
    .map((y, i) => `${i === 0 ? 'M' : 'L'}${round(left + ((right - left) * i) / last)} ${round(y)}`)
    .join('');
}

/** Mittelpunktverschiebung: natuerliche Bergkaemme, Werte 0 bis 1. */
function ridge(rand, levels, roughness) {
  const count = 2 ** levels + 1;
  const values = new Array(count).fill(0);
  values[0] = rand();
  values[count - 1] = rand();
  let step = count - 1;
  let scale = 1;
  while (step > 1) {
    const half = step / 2;
    for (let i = half; i < count; i += step) {
      values[i] = (values[i - half] + values[i + half]) / 2 + (rand() - 0.5) * scale;
    }
    step = half;
    scale *= roughness;
  }
  return normalise(values);
}

function normalise(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return values.map((value) => (value - min) / (max - min || 1));
}

/** Gleitender Mittelwert — ferne Kaemme wirken weicher. */
function soften(values, radius) {
  if (radius <= 0) return values;
  return values.map((_, i) => {
    let sum = 0;
    let count = 0;
    for (let k = i - radius; k <= i + radius; k += 1) {
      const value = values[Math.min(values.length - 1, Math.max(0, k))];
      sum += value;
      count += 1;
    }
    return sum / count;
  });
}

/**
 * Sanfte Wellen aus Sinusanteilen, Werte 0 bis 1. `skew` macht eine Seite
 * steiler — so stehen Duenen im Wind.
 */
function waves(rand, count, parts) {
  const phases = parts.map(() => rand() * Math.PI * 2);
  const values = Array.from({ length: count }, (_, i) => {
    const x = (i / (count - 1)) * (W + OVER * 2);
    return parts.reduce((sum, part, k) => {
      const t = (x / part.period) * Math.PI * 2 + (phases[k] ?? 0);
      return sum + part.amp * Math.sin(t + (part.skew ?? 0) * Math.sin(t));
    }, 0);
  });
  return normalise(values);
}

/** Nebel, der von oben durchsichtig nach unten dicht wird und dicht bleibt. */
function fog(c, top, dense, color, opacity) {
  c.add(
    `<rect x="${-OVER}" y="${round(top)}" width="${W + OVER * 2}" height="${round(H + OVER - top)}" fill="${c.vertical(
      [
        [0, color, 0],
        [1, color, opacity],
      ],
      top,
      dense,
    )}"/>`,
  );
}

function sky(c, stops) {
  c.add(`<rect x="0" y="0" width="${W}" height="${H}" fill="${c.vertical(stops)}"/>`);
}

function glow(c, cx, cy, r, color, opacity) {
  c.add(
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${c.radial(cx, cy, r, color, opacity)}"/>`,
  );
}

function stars(c, rand, count, bottom, colour = '#FFFFFF') {
  const dots = Array.from({ length: count }, () => {
    const x = rand() * W;
    // Nach unten hin seltener, wie im Dunst ueber dem Horizont.
    const y = bottom * rand() ** 1.6;
    const r = 1.2 + rand() * 1.8;
    const opacity = 0.18 + rand() * 0.55;
    return `<circle cx="${round(x)}" cy="${round(y)}" r="${round(r)}" fill="${colour}" fill-opacity="${round(opacity * 100) / 100}"/>`;
  });
  c.add(`<g${c.blur(0.6)}>${dots.join('')}</g>`);
}

/** Ein Bergzug mit Nebel darunter. */
function mountainLayers(c, rand, layers, mist) {
  layers.forEach((layer, index) => {
    const values = soften(ridge(rand, 8, layer.roughness ?? 0.52), layer.soften ?? 0);
    const heights = values.map((v) => layer.base - layer.amp * v ** (layer.power ?? 1.15));
    c.add(`<path d="${silhouette(heights)}" fill="${layer.color}"${c.blur(layer.blur)}/>`);
    const next = layers[index + 1];
    if (next && mist) {
      fog(c, layer.base - layer.amp * 0.55, next.base - next.amp * 0.1, mist.color, mist.opacity);
    }
  });
}

/** Eine Tanne als gestufte Silhouette. */
function pine(x, ground, height, width) {
  const tiers = 5;
  const right = [];
  const left = [];
  for (let j = 1; j <= tiers; j += 1) {
    const t = j / tiers;
    const y = ground - height + height * t * 0.92;
    const outer = width * (0.25 + 0.75 * t);
    const inner = outer * 0.52;
    right.push([x + outer, y], [x + inner, y - height * 0.035]);
    left.unshift([x - inner, y - height * 0.035], [x - outer, y]);
  }
  right.pop();
  left.shift();
  const trunk = width * 0.08;
  const points = [
    [x, ground - height],
    ...right,
    [x + trunk, ground],
    [x - trunk, ground],
    ...left,
  ];
  return `M${points.map(([px, py]) => `${round(px)} ${round(py)}`).join('L')}Z`;
}

// ------------------------------------------------------------ Motive

const SCENES = {
  /** Berge im Nebel — hell, blaugrau, warmer Dunst. */
  mist(c, rand) {
    sky(c, [
      [0, '#E4E9EC'],
      [0.42, '#F3F2ED'],
      [1, '#EEEFEA'],
    ]);
    glow(c, 700, 620, 520, '#FFFDF6', 0.85);
    mountainLayers(
      c,
      rand,
      [
        { base: 1010, amp: 300, color: '#CDD4D8', blur: 3, soften: 3, roughness: 0.5 },
        { base: 1150, amp: 260, color: '#B8C2C8', blur: 2.2, soften: 2 },
        { base: 1310, amp: 240, color: '#A0ACB4', blur: 1.6, soften: 1 },
        { base: 1490, amp: 220, color: '#8896A0', blur: 1.1 },
        { base: 1700, amp: 190, color: '#71808B', blur: 0.7 },
      ],
      { color: '#F4F3EE', opacity: 0.86 },
    );
  },

  /** Stiller See — Huegel am Horizont, gespiegelt im Wasser. */
  lake(c, rand) {
    const horizon = 1080;
    sky(c, [
      [0, '#E6ECEC'],
      [0.45, '#F4F1EA'],
      [horizon / H, '#F6EEE2'],
      [1, '#F6EEE2'],
    ]);
    glow(c, 560, horizon - 60, 520, '#FFF3DE', 0.9);

    // Glocken statt Geraden: jeder Huegel steigt weich an und faellt weich ab.
    const bell = (x, centre, width) => Math.exp(-(((x - centre) / width) ** 2));
    const shaped = (roughness, radius, lift) =>
      soften(ridge(rand, 8, roughness), radius).map((v, i, all) => lift(v, i / (all.length - 1)));
    const far = shaped(0.45, 5, (v) => horizon - 24 - 120 * v);
    const left = shaped(0.55, 2, (v, x) => horizon + 2 - bell(x, 0.08, 0.3) * (150 + 300 * v));
    const right = shaped(0.55, 2, (v, x) => horizon + 2 - bell(x, 0.95, 0.2) * (70 + 170 * v));

    const hills = `<path d="${silhouette(far, horizon + 2)}" fill="#BEC7C4"/>
      <path d="${silhouette(right, horizon + 2)}" fill="#A6B2AF"/>
      <path d="${silhouette(left, horizon + 2)}" fill="#94A29F"/>`;
    c.add(`<g${c.blur(1.4)}>${hills}</g>`);

    // Wasser
    c.add(
      `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="${c.vertical(
        [
          [0, '#EDEDE6'],
          [0.35, '#DCE3E1'],
          [1, '#C3D0CF'],
        ],
        horizon,
        H,
      )}"/>`,
    );
    // Spiegelung: dieselben Huegel, gestaucht und weich
    c.add(
      `<g opacity="0.42" transform="translate(0 ${horizon * 2}) scale(1 -1)"${c.blur(7)}>${hills}</g>`,
    );
    fog(c, horizon, horizon + 520, '#DDE4E2', 0.55);

    // Kraeuselungen: lange, blasse Lichtstreifen, am Horizont dichter
    const lines = Array.from({ length: 34 }, () => {
      const depth = rand() ** 2.2;
      const y = horizon + 16 + (H - horizon - 60) * depth;
      const width = 260 + rand() * 620;
      const x = rand() * (W + 300) - 150 - width / 4;
      const light = rand() > 0.3;
      const height = 1.6 + depth * 4;
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(width)}" height="${round(height)}" rx="${round(height / 2)}" fill="${light ? '#FFFFFF' : '#98A9A7'}" fill-opacity="${light ? 0.3 : 0.14}"/>`;
    });
    c.add(`<g${c.blur(2.6)}>${lines.join('')}</g>`);
    glow(c, 560, horizon + 40, 320, '#FFF8EA', 0.4);
  },

  /** Wald im Dunst — Tannenreihen, die nach hinten im Nebel verschwinden. */
  forest(c, rand) {
    sky(c, [
      [0, '#E3E8E2'],
      [0.45, '#F1F1EB'],
      [1, '#ECEEE7'],
    ]);
    glow(c, 320, 700, 560, '#FFFEF6', 0.8);

    const layers = [
      { base: 1000, hill: 70, min: 60, max: 110, gap: [12, 26], color: '#C6CEC5', blur: 2.4 },
      { base: 1140, hill: 80, min: 80, max: 150, gap: [16, 32], color: '#B0BCB1', blur: 1.8 },
      { base: 1300, hill: 90, min: 110, max: 200, gap: [22, 42], color: '#98A69A', blur: 1.3 },
      { base: 1480, hill: 90, min: 150, max: 270, gap: [30, 58], color: '#809083', blur: 0.8 },
      { base: 1700, hill: 80, min: 210, max: 360, gap: [48, 90], color: '#6B7C6E', blur: 0.5 },
    ];

    layers.forEach((layer, index) => {
      const ground = waves(rand, 129, [
        { period: 900, amp: 1 },
        { period: 380, amp: 0.4 },
      ]).map((v) => layer.base - layer.hill * v);
      const groundAt = (x) => {
        const i = Math.round(((x + OVER) / (W + OVER * 2)) * (ground.length - 1));
        return ground[Math.min(ground.length - 1, Math.max(0, i))];
      };
      const trees = [];
      for (let x = -OVER + rand() * 20; x < W + OVER;) {
        const height = layer.min + (layer.max - layer.min) * rand();
        trees.push(pine(x, groundAt(x) + height * 0.08, height, height * (0.2 + rand() * 0.06)));
        x += layer.gap[0] + (layer.gap[1] - layer.gap[0]) * rand();
      }
      c.add(
        `<g fill="${layer.color}"${c.blur(layer.blur)}><path d="${silhouette(ground)}"/><path d="${trees.join('')}"/></g>`,
      );
      const next = layers[index + 1];
      if (next) fog(c, layer.base - layer.max * 0.7, next.base - next.max * 0.15, '#EFF0EA', 0.82);
    });
    // Bodennebel, damit die vorderste Reihe nicht als dunkle Wand steht.
    fog(c, 1480, 1920, '#EFF0EA', 0.4);
  },

  /** Duenen — warmer Sand, Kaemme mit Lichtsaum. */
  dunes(c, rand) {
    sky(c, [
      [0, '#EFE6DA'],
      [0.45, '#F7F1E8'],
      [1, '#F2E6D6'],
    ]);
    glow(c, 780, 820, 560, '#FFF6E6', 0.9);

    const layers = [
      { base: 1060, amp: 120, top: '#EBDCC8', bottom: '#E3D0B8', period: 1500, blur: 2.2 },
      { base: 1210, amp: 160, top: '#E6D0B3', bottom: '#DAC09F', period: 1250, blur: 1.6 },
      { base: 1390, amp: 190, top: '#E0C29F', bottom: '#D0AF89', period: 1100, blur: 1.1 },
      { base: 1590, amp: 210, top: '#D8B38C', bottom: '#C69D76', period: 1000, blur: 0.7 },
      { base: 1810, amp: 200, top: '#CFA47E', bottom: '#BA8C67', period: 950, blur: 0.4 },
    ];
    layers.forEach((layer, index) => {
      const heights = waves(rand, 161, [
        { period: layer.period, amp: 1, skew: 0.7 },
        { period: layer.period * 0.43, amp: 0.28, skew: 0.5 },
      ]).map((v) => layer.base - layer.amp * v);
      const fill = c.vertical(
        [
          [0, layer.top],
          [1, layer.bottom],
        ],
        layer.base - layer.amp,
        layer.base + 260,
      );
      c.add(`<path d="${silhouette(heights)}" fill="${fill}"${c.blur(layer.blur)}/>`);
      c.add(
        `<path d="${crest(heights)}" fill="none" stroke="#FFF7EC" stroke-opacity="0.55" stroke-width="4"${c.blur(2.4)}/>`,
      );
      const next = layers[index + 1];
      if (next) fog(c, layer.base - layer.amp * 0.4, next.base - next.amp * 0.2, '#F4EADC', 0.6);
    });
  },

  /** Schneefeld — sanfte Haenge im kalten Licht. */
  snow(c, rand) {
    sky(c, [
      [0, '#E7EDF1'],
      [0.5, '#F6F7F6'],
      [1, '#F2F5F6'],
    ]);
    glow(c, 360, 760, 560, '#FFFFFF', 0.9);
    mountainLayers(
      c,
      rand,
      [
        { base: 1060, amp: 280, color: '#D9E1E7', blur: 2.4, soften: 2, roughness: 0.5 },
        { base: 1170, amp: 200, color: '#CAD5DD', blur: 1.8, soften: 1 },
      ],
      { color: '#F4F6F6', opacity: 0.8 },
    );
    fog(c, 900, 1240, '#F4F6F6', 0.85);

    const slopes = [
      { base: 1320, amp: 150, top: '#FBFCFC', bottom: '#E6ECF0' },
      { base: 1520, amp: 180, top: '#FCFDFD', bottom: '#DEE6EC' },
      { base: 1760, amp: 190, top: '#FDFDFD', bottom: '#D6E0E7' },
    ];
    slopes.forEach((slope) => {
      const heights = waves(rand, 129, [
        { period: 1600, amp: 1, skew: 0.3 },
        { period: 620, amp: 0.25 },
      ]).map((v) => slope.base - slope.amp * v);
      // Ein blauer Schatten unter dem Kamm trennt die Haenge.
      c.add(
        `<path d="${crest(heights.map((y) => y + 18))}" fill="none" stroke="#B8C7D2" stroke-opacity="0.45" stroke-width="22"${c.blur(12)}/>`,
      );
      c.add(
        `<path d="${silhouette(heights)}" fill="${c.vertical(
          [
            [0, slope.top],
            [1, slope.bottom],
          ],
          slope.base - slope.amp,
          slope.base + 320,
        )}"${c.blur(0.8)}/>`,
      );
    });
  },

  /** Pastell — weiche Farbflaechen ohne Motiv. */
  bloom(c) {
    c.add(`<rect x="0" y="0" width="${W}" height="${H}" fill="#F5F1EA"/>`);
    const blobs = [
      [160, 360, 440, '#CFDFC3'],
      [940, 640, 470, '#F1CDB6'],
      [620, 1060, 320, '#EFDDB2'],
      [260, 1380, 520, '#D2CBE9'],
      [930, 1700, 480, '#BEDADD'],
    ];
    c.add(
      `<g${c.blur(150)}>${blobs
        .map(([cx, cy, r, color]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`)
        .join('')}</g>`,
    );
  },

  /** Abendrot — der Himmel gluehend ueber dunklen Huegelketten. */
  dusk(c, rand) {
    sky(c, [
      [0, '#1C1A2B'],
      [0.3, '#2F2840'],
      [0.52, '#5D4257'],
      [0.64, '#9A6263'],
      [0.7, '#A86C62'],
      [1, '#A86C62'],
    ]);
    glow(c, 560, 1240, 760, '#D98B6F', 0.55);
    c.add(`<circle cx="560" cy="1225" r="62" fill="#F0B48C" fill-opacity="0.85"${c.blur(8)}/>`);
    mountainLayers(
      c,
      rand,
      [
        { base: 1290, amp: 130, color: '#6E4859', blur: 2.2, soften: 3, roughness: 0.48 },
        { base: 1400, amp: 170, color: '#533749', blur: 1.5, soften: 2 },
        { base: 1560, amp: 190, color: '#3B2A3D', blur: 1 },
        { base: 1760, amp: 170, color: '#271D2B', blur: 0.6 },
      ],
      { color: '#8E5A62', opacity: 0.55 },
    );
  },

  /** Mondnacht — dieselben Berge im Nebel, bei Nacht. */
  moon(c, rand) {
    sky(c, [
      [0, '#0C111C'],
      [0.45, '#172031'],
      [1, '#222D3F'],
    ]);
    stars(c, rand, 110, 900, '#E9EEF5');
    glow(c, 760, 560, 440, '#9DB2C9', 0.38);
    c.add(`<circle cx="760" cy="560" r="44" fill="#ECEEE6"${c.blur(1.2)}/>`);
    mountainLayers(
      c,
      rand,
      [
        { base: 1080, amp: 300, color: '#2E3A4D', blur: 2.6, soften: 3, roughness: 0.5 },
        { base: 1230, amp: 260, color: '#253144', blur: 2, soften: 2 },
        { base: 1400, amp: 240, color: '#1D2839', blur: 1.4, soften: 1 },
        { base: 1590, amp: 220, color: '#161F2D', blur: 1 },
        { base: 1800, amp: 180, color: '#0F1620', blur: 0.6 },
      ],
      { color: '#3A4A5F', opacity: 0.6 },
    );
  },

  /** Nordlicht — gruene Vorhaenge ueber einem dunklen Grat. */
  aurora(c, rand) {
    sky(c, [
      [0, '#060D16'],
      [0.5, '#0A1822'],
      [0.8, '#0F2429'],
      [1, '#0F2429'],
    ]);
    glow(c, 900, 120, 700, '#3B2F5E', 0.4);
    stars(c, rand, 140, 1200, '#E6F2EE');

    // Alle Baender folgen derselben Welle, nur versetzt: so laufen sie
    // nebeneinander her, statt sich zu einem Ring zu kreuzen.
    const phase = rand() * Math.PI * 2;
    const band = (base, amplitude) => (x) =>
      base -
      (x - W / 2) * 0.32 +
      amplitude * Math.sin((x / 1700) * Math.PI * 2 + phase) +
      amplitude * 0.3 * Math.sin((x / 610) * Math.PI * 2 + phase * 1.7);
    const ribbons = [
      { y: band(700, 90), color: '#3FD6A2', opacity: 0.44, width: 150 },
      { y: band(560, 70), color: '#2FB8A8', opacity: 0.26, width: 120 },
      { y: band(840, 60), color: '#8BE6B7', opacity: 0.16, width: 90 },
    ];
    ribbons.forEach((ribbon) => {
      const points = Array.from({ length: 60 }, (_, i) => {
        const x = -OVER * 2 + ((W + OVER * 4) * i) / 59;
        return `${i === 0 ? 'M' : 'L'}${round(x)} ${round(ribbon.y(x))}`;
      }).join('');
      c.add(
        `<path d="${points}" fill="none" stroke="${ribbon.color}" stroke-opacity="${ribbon.opacity}" stroke-width="${ribbon.width}" stroke-linecap="round"${c.blur(42)}/>`,
      );
      // Vorhaenge: schmale Streifen, die nach oben verblassen
      const curtain = c.boxVertical([
        [0, ribbon.color, 0.9],
        [0.25, ribbon.color, 0.5],
        [1, ribbon.color, 0],
      ]);
      const strips = [];
      for (let x = -OVER; x < W + OVER; x += 7 + rand() * 7) {
        const length = 140 + 320 * rand() ** 1.4;
        const bottom = ribbon.y(x) + 30;
        strips.push(
          `<rect x="${round(x)}" y="${round(bottom - length)}" width="${round(3 + rand() * 4)}" height="${round(length)}" fill="${curtain}"/>`,
        );
      }
      c.add(
        `<g opacity="${round(ribbon.opacity * 0.5 * 100) / 100}"${c.blur(5)}>${strips.join('')}</g>`,
      );
    });

    glow(c, 540, 1300, 600, '#1E5A55', 0.35);
    const far = soften(ridge(rand, 8, 0.5), 2).map((v) => 1560 - 230 * v ** 1.2);
    c.add(`<path d="${silhouette(far)}" fill="#0B1A20"${c.blur(1.4)}/>`);
    c.add(
      `<path d="${crest(far)}" fill="none" stroke="#3E8F86" stroke-opacity="0.35" stroke-width="3"${c.blur(2)}/>`,
    );
    fog(c, 1400, 1760, '#10272B', 0.5);
    const near = ridge(rand, 8, 0.55).map((v) => 1790 - 170 * v ** 1.1);
    c.add(`<path d="${silhouette(near)}" fill="#050B10"${c.blur(0.6)}/>`);
  },

  /**
   * Weiss — Papier ohne Motiv, oben eine Spur heller. Fuer alle, die hinter
   * der App gar nichts wollen.
   */
  paper(c) {
    sky(c, [
      [0, '#FFFFFF'],
      [0.55, '#FAFAF9'],
      [1, '#F1F1EE'],
    ]);
    glow(c, 540, 480, 760, '#FFFFFF', 0.9);
  },

  /** Schwarz — dasselbe in tief, nach unten fast ohne Licht. */
  ink(c) {
    sky(c, [
      [0, '#1B1B1D'],
      [0.55, '#121214'],
      [1, '#08080A'],
    ]);
    glow(c, 540, 420, 780, '#2C2C31', 0.55);
  },

  /** Nachtblau — tiefe, weiche Farbflaechen ohne Motiv. */
  night(c) {
    c.add(`<rect x="0" y="0" width="${W}" height="${H}" fill="#101316"/>`);
    const blobs = [
      [180, 400, 480, '#1B343A'],
      [920, 880, 520, '#232849'],
      [340, 1480, 560, '#1D3024'],
      [900, 1760, 420, '#2B2339'],
    ];
    c.add(
      `<g${c.blur(160)}>${blobs
        .map(([cx, cy, r, color]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>`)
        .join('')}</g>`,
    );
  },
};

/** Reihenfolge und Samen. Neue Motive hier und in theme/backdrops.ts eintragen. */
const BACKDROPS = [
  { key: 'mist', seed: 11 },
  { key: 'lake', seed: 23 },
  { key: 'forest', seed: 37 },
  { key: 'dunes', seed: 41 },
  { key: 'snow', seed: 53 },
  { key: 'bloom', seed: 67 },
  { key: 'dusk', seed: 71 },
  { key: 'moon', seed: 83 },
  { key: 'aurora', seed: 97 },
  { key: 'night', seed: 101 },
  { key: 'paper', seed: 103 },
  { key: 'ink', seed: 107 },
];

// ------------------------------------------------------------ Schreiben

/**
 * Feines, festes Korn. Es verhindert Stufen in den weiten Verlaeufen, die
 * JPEG sonst hineinrechnet — und nimmt dem Bild das Kuenstliche.
 */
function addGrain(pixels, seed, strength) {
  const rand = random(seed * 7919);
  const out = Buffer.alloc(pixels.length);
  for (let i = 0; i < pixels.length; i += 3) {
    // Dasselbe Korn auf allen drei Kanaelen: es wirkt wie Film, nicht wie Farbrauschen.
    const noise = (rand() + rand() + rand() - 1.5) * strength;
    for (let k = 0; k < 3; k += 1) {
      out[i + k] = Math.max(0, Math.min(255, Math.round(pixels[i + k] + noise)));
    }
  }
  return out;
}

async function atomicWrite(buffer, target) {
  const temporary = `${target}.${process.pid}.new`;
  await fs.promises.writeFile(temporary, buffer);
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

async function render({ key, seed }, out) {
  const scene = SCENES[key];
  if (!scene) throw new Error(`Kein Motiv fuer "${key}".`);
  const c = canvas();
  scene(c, random(seed));

  const flat = await sharp(Buffer.from(c.svg()))
    .flatten({ background: '#FFFFFF' })
    .removeAlpha()
    .raw()
    .toBuffer();

  const image = addGrain(flat, seed, GRAIN);

  const raw = { raw: { width: W, height: H, channels: 3 } };
  const full = await sharp(image, raw)
    .jpeg({ quality: QUALITY, mozjpeg: true, chromaSubsampling: '4:2:0' })
    .toBuffer();
  const thumb = await sharp(image, raw)
    .resize(THUMB.width, THUMB.height)
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();

  await atomicWrite(full, path.join(out, `${key}.jpg`));
  await atomicWrite(thumb, path.join(out, `${key}-thumb.jpg`));
  return { key, full: full.length, thumb: thumb.length };
}

/**
 * `node scripts/backdrops.js` schreibt alle; `node scripts/backdrops.js dunes mist`
 * nur diese; `--out=<ordner>` schreibt zum Ausprobieren woandershin.
 */
async function main() {
  const args = process.argv.slice(2);
  const outArg = args.find((arg) => arg.startsWith('--out='));
  const out = outArg ? path.resolve(outArg.slice('--out='.length)) : OUT;
  const only = args.filter((arg) => !arg.startsWith('--'));
  const list = only.length > 0 ? BACKDROPS.filter((item) => only.includes(item.key)) : BACKDROPS;
  fs.mkdirSync(out, { recursive: true });
  // Nacheinander: laufende Metro-Server sperren unter Windows sonst kurz die Dateien.
  for (const item of list) {
    const { key, full, thumb } = await render(item, out);
    process.stdout.write(
      `${key.padEnd(8)} ${Math.round(full / 1024)} KB, Vorschau ${Math.round(thumb / 1024)} KB\n`,
    );
  }
  process.stdout.write(`${list.length} Hintergruende geschrieben.\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack ?? error.message}\n`);
  process.exit(1);
});
