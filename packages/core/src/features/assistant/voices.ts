/**
 * Welche Stimme wie klingt — reine Rechnung ohne Browser, damit sie unter Node
 * getestet werden kann.
 *
 * Browser bringen sehr unterschiedliche Stimmen mit: Edge die natuerlichen
 * „Online (Natural)“-Stimmen, Safari „Enhanced“ und „Premium“, Chrome
 * „Google Deutsch“ aus dem Netz — und fast alle dazu die blechernen
 * Sprachpakete des Betriebssystems. Die guten gehoeren nach oben.
 */

/** `natural` klingt wie ein Mensch, `clear` sauber, `basic` blechern. */
export type VoiceTier = 'natural' | 'clear' | 'basic';

/** Eine Stimme, wie der Browser sie meldet. */
export type RawVoice = {
  /** Eindeutig je Stimme — dieser Wert steht auch im Konto. */
  uri: string;
  name: string;
  /** Vollstaendiges Sprachkennzeichen, etwa `de-CH`. */
  tag: string;
  /** Auf dem Geraet gerechnet, nicht im Netz. */
  local: boolean;
};

export type RankedVoice = RawVoice & {
  tier: VoiceTier;
  /** Kurz und ohne Hersteller: „Katja“ statt „Microsoft Katja Online (Natural) - German (Germany)“. */
  label: string;
};

const NATURAL = /natural|neural|premium|enhanced|wavenet|studio/i;

const TIER_ORDER: Record<VoiceTier, number> = { natural: 0, clear: 1, basic: 2 };

/** So viele bessere Stimmen braucht es, damit die blechernen wegfallen duerfen. */
const ENOUGH_BETTER = 2;

export function tierOf(voice: RawVoice): VoiceTier {
  if (NATURAL.test(`${voice.name} ${voice.uri}`)) return 'natural';
  // Stimmen aus dem Netz klingen deutlich besser als die eingebauten Sprachpakete.
  if (!voice.local) return 'clear';
  return 'basic';
}

export function labelOf(name: string): string {
  const plain = name
    .replace(/\s+-\s+.*$/, '')
    .replace(/\s*\([^)]*\)/g, '')
    .replace(/\bOnline\b/gi, '')
    .replace(/^(Microsoft|Apple)\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0 ? plain : name;
}

function normalTag(tag: string): string {
  return tag.toLowerCase().replace('_', '-');
}

/**
 * Die Stimmen dieser Sprache, die natuerlich klingenden zuerst; bei gleicher
 * Guete die bevorzugte Fassung (etwa `de-CH`), danach nach Namen.
 */
export function rankVoices(
  voices: readonly RawVoice[],
  language: string,
  preferredTag: string,
): readonly RankedVoice[] {
  const wanted = normalTag(preferredTag);
  return voices
    .filter((voice) => normalTag(voice.tag).startsWith(language.toLowerCase()))
    .map((voice) => ({ ...voice, tier: tierOf(voice), label: labelOf(voice.name) }))
    .sort((a, b) => {
      const tier = TIER_ORDER[a.tier] - TIER_ORDER[b.tier];
      if (tier !== 0) return tier;
      const mine = Number(normalTag(b.tag) === wanted) - Number(normalTag(a.tag) === wanted);
      return mine !== 0 ? mine : a.label.localeCompare(b.label);
    });
}

/**
 * Was zur Wahl steht: die blechernen Stimmen fallen weg, sobald es wenigstens
 * zwei bessere gibt. Sonst bleiben alle — lieber eine einfache Stimme als gar
 * keine Wahl.
 */
export function choosableVoices<T extends RankedVoice>(ranked: readonly T[]): readonly T[] {
  const better = ranked.filter((voice) => voice.tier !== 'basic');
  return better.length >= ENOUGH_BETTER ? better : ranked;
}
