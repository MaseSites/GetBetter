/** Wie der Avatar aussieht: Figur, Farbe, Augen, Zubehoer. Teil von `de` — die Schluessel landen dort per Spread. */
export const deAvatar = {
  'avatar.title': 'Avatar',
  'avatar.hint': 'So sieht dein Assistent aus — in allen Better-Apps gleich.',

  'avatar.kind': 'Figur',
  'avatar.kind.robot': 'Roboter',
  'avatar.kind.blob': 'Knuddel',
  'avatar.kind.cat': 'Katze',
  'avatar.kind.owl': 'Eule',
  'avatar.kind.ghost': 'Gespenst',

  'avatar.color': 'Farbe',
  'avatar.color.accent': 'Wie die App',
  'avatar.color.sky': 'Himmelblau',
  'avatar.color.violet': 'Violett',
  'avatar.color.coral': 'Koralle',
  'avatar.color.sun': 'Sonnengelb',
  'avatar.color.mint': 'Minze',
  'avatar.color.berry': 'Beere',
  'avatar.color.stone': 'Stein',
  'avatar.color.a11y': 'Farbe {color}',
  'avatar.color.mono': 'In Schwarzweiss trägt er keine Farbe.',

  'avatar.eyes': 'Augen',
  'avatar.eyes.round': 'Rund',
  'avatar.eyes.happy': 'Fröhlich',
  'avatar.eyes.sleepy': 'Verschlafen',
  'avatar.eyes.sparkle': 'Funkelnd',
  'avatar.eyes.a11y': 'Augen: {eyes}',

  'avatar.accessory': 'Zubehör',
  'avatar.accessory.none': 'Ohne',
  'avatar.accessory.antenna': 'Antenne',
  'avatar.accessory.hat': 'Hut',
  'avatar.accessory.glasses': 'Brille',
  'avatar.accessory.bow': 'Schleife',
  'avatar.accessory.a11y': 'Zubehör: {accessory}',

  'avatar.selected': '{label}, gewählt',

  // Einrichten: er stellt sich vor und verwandelt sich
  'intro.setup.avatar.bubble':
    'Freut mich! So sehe ich als {assistant} aus. Such dir eine Figur und eine Farbe aus — ich verwandle mich sofort.',
  'intro.setup.style.bubbleAfterAvatar':
    'So gefalle ich mir. Jetzt noch zur App — jede Änderung wirkt sofort.',
} as const;
