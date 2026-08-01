import {
  shouldExcludeListing,
  type PartProfile,
} from "../database/import/partProfiles";

export type PartTitleMatch = {
  accepted: boolean;
  reason: string;
  matchedPhrase: string | null;
};

const QUALIFIERS = new Set([
  "komplett",
  "komplette",
  "original",
  "oem",
  "gebraucht",
  "fahrer",
  "sozius",
  "satz",
  "paar",
  "anlage",
  "mit",
  "papieren",
]);

const ACCESSORY_TERMS = [
  "halter",
  "halterung",
  "befestigung",
  "aufnahme",
  "adapter",
  "gummi",
  "schraube",
  "schrauben",
  "schraubensatz",
  "dichtung",
  "dichtsatz",
  "reparatursatz",
  "reparaturkit",
  "reparatur kit",
  "kabel",
  "stecker",
  "abdeckung",
  "deckel",
  "schutz",
  "bezug",
  "aufkleber",
  "dekor",
  "emblem",
  "sensor",
  "geber",
  "membran",
  "lager",
  "buchse",
  "simmerring",
  "dichtring",
  "kit",
];


const TOKEN_STEM_OVERRIDES: Record<string, string> = {
  bremssaettel: "bremssattel",
  saettel: "sattel",
  bremsscheiben: "bremsscheib",
  bremsscheibe: "bremsscheib",
  scheiben: "scheib",
  scheibe: "scheib",
  zuendspulen: "zuendspul",
  zuendspule: "zuendspul",
  spulen: "spul",
  spule: "spul",
  einspritzduesen: "einspritzdues",
  einspritzduese: "einspritzdues",
  duesen: "dues",
  duese: "dues",
  bremsleitungen: "bremsleitung",
  leitungen: "leitung",
  haltegriffe: "haltegriff",
  griffe: "griff",
  spiegel: "spiegel",
  felgen: "felge",
  hebel: "hebel",
};

function tokenStem(token: string) {
  const overridden = TOKEN_STEM_OVERRIDES[token];
  if (overridden) return overridden;
  if (token.length >= 6 && token.endsWith("ungen")) return token.slice(0, -2);
  if (token.length >= 6 && token.endsWith("en")) return token.slice(0, -1);
  if (token.length >= 5 && token.endsWith("e")) return token.slice(0, -1);
  return token;
}

function stemSet(value: string) {
  return new Set(normalizePartTitle(value).split(" ").filter(Boolean).map(tokenStem));
}

const SIDE_CONFLICTS: Array<[string, string]> = [
  ["links", "rechts"],
  ["rechts", "links"],
  ["vorne", "hinten"],
  ["hinten", "vorne"],
  ["vorderrad", "hinterrad"],
  ["hinterrad", "vorderrad"],
];

export function normalizePartTitle(value: string) {
  return value
    .toLocaleLowerCase("de-DE")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string) {
  return normalizePartTitle(value).replace(/\s+/g, "");
}

function containsPhrase(title: string, phrase: string) {
  const normalized = normalizePartTitle(phrase);
  if (!normalized) return false;
  return (` ${title} `).includes(` ${normalized} `);
}

function phraseAlternatives(value: string) {
  const normalized = normalizePartTitle(value);
  const results = new Set<string>();
  if (normalized) results.add(normalized);

  for (const segment of value.split(/\s*\/\s*|\s+oder\s+/i)) {
    const candidate = normalizePartTitle(segment);
    if (candidate) results.add(candidate);
  }

  return [...results];
}

function significantTokens(value: string) {
  return normalizePartTitle(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !QUALIFIERS.has(token));
}

const COMPOUND_MODIFIERS = [
  "innen", "aussen", "vorderrad", "hinterrad", "vorder", "vorne", "hinter", "hinten", "seiten",
  "front", "heck", "motor", "tank", "sitzbank", "scheinwerfer",
  "kennzeichen", "koffer", "lenker", "kupplung", "lichtmaschine",
  "ritzel", "hitzeschutz", "kuehler", "anlasser", "brems", "zuend",
  "fussrasten", "sozius", "fahrer", "rad", "gabel",
];

function splitKnownCompound(token: string) {
  const pieces: string[] = [];
  let rest = token;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const prefix = COMPOUND_MODIFIERS
      .filter((candidate) => rest.startsWith(candidate) && rest.length - candidate.length >= 4)
      .sort((a, b) => b.length - a.length)[0];
    if (!prefix) break;
    pieces.push(prefix);
    rest = rest.slice(prefix.length);
  }
  if (pieces.length && rest.length >= 4) pieces.push(rest);
  return pieces;
}

function hasDirectionConflict(title: string, partName: string) {
  const normalizedPart = normalizePartTitle(partName);
  for (const [required, forbidden] of SIDE_CONFLICTS) {
    if (containsPhrase(normalizedPart, required) && containsPhrase(title, forbidden)) {
      return forbidden;
    }
  }
  return null;
}

function hasGenericAccessoryConflict(title: string, partName: string) {
  const normalizedPart = normalizePartTitle(partName);
  for (const term of ACCESSORY_TERMS) {
    const normalizedTerm = normalizePartTitle(term);
    if (!normalizedTerm
      || containsPhrase(normalizedPart, normalizedTerm)
      || compact(normalizedPart).includes(compact(normalizedTerm))) continue;
    if (containsPhrase(title, normalizedTerm)) return term;
  }
  return null;
}

function compoundAccessoryConflict(title: string, partName: string) {
  const normalizedPart = normalizePartTitle(partName);
  const coreTokens = significantTokens(partName)
    .filter((token) => token.length >= 4)
    .slice(0, 3);
  const compactTitle = compact(title);

  for (const core of coreTokens) {
    const compactCore = compact(core);
    for (const suffix of ACCESSORY_TERMS) {
      const compactSuffix = compact(suffix);
      if (!compactSuffix || compact(normalizedPart).includes(`${compactCore}${compactSuffix}`)) continue;
      if (compactTitle.includes(`${compactCore}${compactSuffix}`)) return `${core}${suffix}`;
    }
  }
  return null;
}

/**
 * Matches the offered object, not merely a word somewhere in the title.
 * This deliberately prefers false negatives over pricing a tank from a tank
 * bracket or a complete engine from a sensor that mentions "Motor".
 */
export function matchListingToPart(
  titleValue: string,
  partName: string,
  profile: PartProfile,
): PartTitleMatch {
  const title = normalizePartTitle(titleValue);
  if (!title) return { accepted: false, reason: "empty-title", matchedPhrase: null };

  const excluded = shouldExcludeListing(titleValue, profile);
  if (excluded.excluded) {
    return { accepted: false, reason: `profile-exclude:${excluded.matchedTerm}`, matchedPhrase: null };
  }

  const directionConflict = hasDirectionConflict(title, partName);
  if (directionConflict) {
    return { accepted: false, reason: `wrong-side:${directionConflict}`, matchedPhrase: null };
  }

  const accessoryConflict = hasGenericAccessoryConflict(title, partName);
  if (accessoryConflict) {
    return { accepted: false, reason: `accessory:${accessoryConflict}`, matchedPhrase: null };
  }

  const compoundConflict = compoundAccessoryConflict(title, partName);
  if (compoundConflict) {
    return { accepted: false, reason: `compound-accessory:${compoundConflict}`, matchedPhrase: null };
  }

  const candidates = [...new Set([
    profile.canonicalName,
    ...profile.searchTerms,
    ...profile.aliases,
    ...phraseAlternatives(partName),
  ].flatMap(phraseAlternatives))]
    .map(normalizePartTitle)
    .filter((phrase) => phrase.length >= 3);

  for (const phrase of candidates) {
    if (containsPhrase(title, phrase)) {
      return { accepted: true, reason: "exact-phrase", matchedPhrase: phrase };
    }
  }

  // Sellers often insert one harmless qualifier into a compound part name.
  // Accept only when every meaningful token from one candidate is present as
  // its own word. A single shared word is never sufficient.
  const titleStems = stemSet(title);
  for (const phrase of candidates) {
    const tokens = significantTokens(phrase);
    if (tokens.length >= 2 && tokens.every((token) => containsPhrase(title, token))) {
      return { accepted: true, reason: "all-significant-tokens", matchedPhrase: phrase };
    }
    const stems = [...new Set(tokens.map(tokenStem))];
    if (stems.length >= 2 && stems.every((stem) => titleStems.has(stem))) {
      return { accepted: true, reason: "all-significant-stems", matchedPhrase: phrase };
    }
    // Singular/plural variants of a distinctive compound (for example
    // Zündspule/Zündspulen) remain safe because matching is token-exact:
    // "Tank" does not match the separate token "Tankhalter".
    if (stems.length === 1 && stems[0].length >= 6 && titleStems.has(stems[0])) {
      return { accepted: true, reason: "single-distinctive-stem", matchedPhrase: phrase };
    }
    if (tokens.length === 1) {
      const compoundPieces = splitKnownCompound(tokens[0]);
      if (compoundPieces.length >= 2
        && compoundPieces.every((piece) => containsPhrase(title, piece) || titleStems.has(tokenStem(piece)))) {
        return { accepted: true, reason: "split-german-compound", matchedPhrase: phrase };
      }
    }
  }

  return { accepted: false, reason: "part-not-present", matchedPhrase: null };
}
