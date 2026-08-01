export type MarketCondition =
  | "used"
  | "refurbished"
  | "new-old-stock"
  | "damaged"
  | "unknown";

export type PartProfile = {
  id: string;
  canonicalName: string;

  /**
   * Bezeichnungen, unter denen das Bauteil aus Datenbank,
   * Bilderkennung oder Benutzerangaben kommen kann.
   */
  aliases: string[];

  /**
   * Suchbegriffe, die mit den Modellvarianten kombiniert werden.
   */
  searchTerms: string[];

  /**
   * Anzeigen mit diesen Begriffen werden grundsätzlich verworfen.
   */
  excludeTerms: string[];

  /**
   * Grober Plausibilitätsbereich für Angebotspreise.
   * Das sind keine Marktwerte, sondern nur Schutz vor 1-€-Anzeigen,
   * Tippfehlern und offensichtlich falschen Treffern.
   */
  minPrice: number;
  maxPrice: number;

  /**
   * Begriffe zur automatischen Zustandserkennung.
   */
  conditionTerms: {
    refurbished: string[];
    newOldStock: string[];
    damaged: string[];
  };
};

const COMMON_CONDITION_TERMS: PartProfile["conditionTerms"] = {
  refurbished: [
    "generalüberholt",
    "generalueberholt",
    "überholt",
    "ueberholt",
    "restauriert",
    "regeneriert",
    "instandgesetzt",
    "aufbereitet",
  ],

  newOldStock: [
    "nos",
    "new old stock",
    "neuteil altbestand",
    "lagerbestand",
    "unbenutzt",
    "originalverpackt",
  ],

  damaged: [
    "defekt",
    "beschädigt",
    "beschaedigt",
    "bastler",
    "ersatzteilspender",
    "nicht funktionsfähig",
    "nicht funktionsfaehig",
    "reparaturbedürftig",
    "reparaturbeduerftig",
  ],
};

export const PART_PROFILES: PartProfile[] = [
  {
    id: "fuel-tank",
    canonicalName: "Tank",

    aliases: [
      "tank",
      "benzintank",
      "kraftstofftank",
      "treibstofftank",
    ],

    searchTerms: [
      "Tank",
      "Benzintank",
    ],

    excludeTerms: [
      "tankdeckel",
      "tankverschluss",
      "tankrucksack",
      "tankpad",
      "tankaufkleber",
      "tankemblem",
      "tankhalter",
      "tank halter",
      "tankhalterung",
      "halterung tank",
      "halter für tank",
      "halter fuer tank",
      "tankbefestigung",
      "tank befestigung",
      "tankaufnahme",
      "tankband",
      "tankriemen",
      "tankgummi",
      "ausgleichsbehälter",
      "ausgleichsbehaelter",
      "kühlwasserbehälter",
      "kuehlwasserbehaelter",
      "kühlerausgleichsbehälter",
      "kuehlerausgleichsbehaelter",
      "coolant tank",
      "tankversiegelung",
      "tankreparatur",
      "tank entrosten",
      "miniatur",
      "modellbau",
    ],

    minPrice: 20,
    maxPrice: 3_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "carburetor",
    canonicalName: "Vergaseranlage komplett",

    aliases: [
      "vergaser",
      "vergaseranlage",
      "vergaseranlage komplett",
      "vergaserbank",
      "vergaserbatterie",
      "doppelvergaser",
    ],

    searchTerms: [
      "Vergaser",
      "Vergaserbank",
    ],

    excludeTerms: [
      "reparatursatz",
      "reparatur kit",
      "reparaturkit",
      "dichtsatz",
      "dichtungssatz",
      "düse",
      "duese",
      "düsensatz",
      "duesensatz",
      "membran",
      "schwimmer",
      "schwimmernadel",
      "ansaugstutzen",
      "synchronisation",
      "reiniger",
      "reinigung",
      "ultraschall",
      "generalüberholung",
      "generalueberholung",
      "vergaser überholung",
      "vergaser ueberholung",
      "vergaser reparatur",
      "reparatur vergaser",
      "keyster",
    ],

    minPrice: 20,
    maxPrice: 2_500,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "seat",
    canonicalName: "Sitzbank",

    aliases: [
      "sitzbank",
      "sitz",
      "motorradsitz",
      "fahrersitz",
      "sitzbank fahrer",
      "fahrersitzbank",
      "sattel",
    ],

    searchTerms: [
      "Sitzbank",
      "Sitz",
    ],

    excludeTerms: [
      "sitzbankbezug",
      "sitzbezug",
      "bezug",
      "sitzbankschloss",
      "sitzbankhalter",
      "sitzbankgummi",
      "höcker",
      "hoecker",
      "soziusabdeckung",
      "gelkissen",
      "sitzkissen",
    ],

    minPrice: 15,
    maxPrice: 2_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "engine",
    canonicalName: "Motor komplett",

    aliases: [
      "motor",
      "motor komplett",
      "komplettmotor",
      "triebwerk",
    ],

    searchTerms: [
      "Motor komplett",
      "Motor",
    ],

    excludeTerms: [
      "motordeckel",
      "motorhalter",
      "motorhalterung",
      "motorschutz",
      "motorgehäuse leer",
      "motorgehaeuse leer",
      "dichtung",
      "dichtsatz",
      "kolben",
      "zylinderkopf",
      "zylinder",
      "kurbelwelle",
      "getriebe",
      "anlasser",
      "lichtmaschine",
      "modellmotor",
      "motor reparatur",
      "motor überholung",
      "motor ueberholung",
    ],

    minPrice: 80,
    maxPrice: 12_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "front-fork",
    canonicalName: "Gabel komplett",

    aliases: [
      "gabel",
      "gabel komplett",
      "vorderradgabel",
      "telegabel",
      "federgabel",
    ],

    searchTerms: [
      "Gabel",
      "Telegabel",
    ],

    excludeTerms: [
      "gabelsimmering",
      "simmerring",
      "dichtsatz",
      "gabelöl",
      "gabeloel",
      "gabelbrücke",
      "gabelbruecke",
      "standrohr einzeln",
      "tauchrohr einzeln",
      "gabel reparatur",
      "gabel überholung",
      "gabel ueberholung",
    ],

    minPrice: 30,
    maxPrice: 3_500,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "front-wheel",
    canonicalName: "Vorderrad komplett",

    aliases: [
      "vorderrad",
      "vorderrad komplett",
      "vordere felge",
      "felge vorne",
    ],

    searchTerms: [
      "Vorderrad",
      "Felge vorne",
    ],

    excludeTerms: [
      "reifen",
      "radlager",
      "achse",
      "distanzhülse",
      "distanzhuelse",
      "ventil",
      "felgenband",
      "miniatur",
    ],

    minPrice: 25,
    maxPrice: 3_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "rear-wheel",
    canonicalName: "Hinterrad komplett",

    aliases: [
      "hinterrad",
      "hinterrad komplett",
      "hintere felge",
      "felge hinten",
    ],

    searchTerms: [
      "Hinterrad",
      "Felge hinten",
    ],

    excludeTerms: [
      "reifen",
      "radlager",
      "achse",
      "distanzhülse",
      "distanzhuelse",
      "ritzel",
      "kettenrad",
      "ventil",
      "felgenband",
      "miniatur",
    ],

    minPrice: 25,
    maxPrice: 3_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "frame",
    canonicalName: "Rahmen",

    aliases: [
      "rahmen",
      "rahmen mit papieren",
      "rahmen mit brief",
      "hauptrahmen",
      "fahrgestell",
    ],

    searchTerms: [
      "Rahmen",
      "Hauptrahmen",
    ],

    excludeTerms: [
      "heckrahmen",
      "rahmenschutz",
      "rahmenstopfen",
      "rahmenabdeckung",
      "nummernschildrahmen",
      "bilderrahmen",
      "modellbau",
    ],

    minPrice: 30,
    maxPrice: 5_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "side-cover-right",
    canonicalName: "Seitenverkleidung rechts",

    aliases: [
      "seitenverkleidung rechts",
      "seitendeckel rechts",
      "seitenabdeckung rechts",
      "seitenpanel rechts",
    ],

    searchTerms: [
      "Seitendeckel rechts",
      "Seitenverkleidung rechts",
    ],

    excludeTerms: [
      "links",
      "aufkleber",
      "dekor",
      "halter",
      "schrauben",
      "gummi",
      "miniatur",
    ],

    minPrice: 10,
    maxPrice: 1_500,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "side-cover-left",
    canonicalName: "Seitenverkleidung links",

    aliases: [
      "seitenverkleidung links",
      "seitendeckel links",
      "seitenabdeckung links",
      "seitenpanel links",
    ],

    searchTerms: [
      "Seitendeckel links",
      "Seitenverkleidung links",
    ],

    excludeTerms: [
      "rechts",
      "aufkleber",
      "dekor",
      "halter",
      "schrauben",
      "gummi",
      "miniatur",
    ],

    minPrice: 10,
    maxPrice: 1_500,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "exhaust",
    canonicalName: "Auspuffanlage komplett",

    aliases: [
      "auspuff",
      "auspuffanlage",
      "auspuffanlage komplett",
      "abgasanlage",
      "schalldämpfer",
      "schalldaempfer",
    ],

    searchTerms: [
      "Auspuffanlage",
      "Auspuff komplett",
    ],

    excludeTerms: [
      "dichtung",
      "halter",
      "schelle",
      "hitzeschutz",
      "hitzeblech",
      "auspuff reparatur",
      "endkappe",
      "db killer",
      "dB-killer",
    ],

    minPrice: 25,
    maxPrice: 5_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "headlight",
    canonicalName: "Scheinwerfer komplett",

    aliases: [
      "scheinwerfer",
      "hauptscheinwerfer",
      "frontscheinwerfer",
      "scheinwerfer komplett",
    ],

    searchTerms: [
      "Scheinwerfer",
      "Hauptscheinwerfer",
    ],

    excludeTerms: [
      "birne",
      "leuchtmittel",
      "scheinwerferring",
      "scheinwerferhalter",
      "halter",
      "gitter",
      "schutz",
      "aufkleber",
    ],

    minPrice: 10,
    maxPrice: 2_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },

  {
    id: "speedometer-cluster",
    canonicalName: "Cockpit komplett",

    aliases: [
      "cockpit",
      "cockpit komplett",
      "instrumente",
      "instrumenteneinheit",
      "tacho",
      "tacho / kombiinstrument",
      "tacho kombiinstrument",
      "tachoeinheit",
      "kombiinstrument",
    ],

    searchTerms: [
      "Cockpit",
      "Tacho komplett",
      "Instrumente",
    ],

    excludeTerms: [
      "tachowelle",
      "tachoglas",
      "tachoblende",
      "tacho reparatur",
      "tacho überholung",
      "tacho ueberholung",
      "halter",
      "beleuchtung",
      "birne",
    ],

    minPrice: 15,
    maxPrice: 3_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  },
];

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function singularizeSimple(value: string): string {
  return value
    .replace(/\bkomplett\b/g, "")
    .replace(/\bkomplette\b/g, "")
    .replace(/\bgebraucht\b/g, "")
    .replace(/\boriginal\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function getPartProfile(
  partName: string,
): PartProfile {
  const normalizedPart = singularizeSimple(
    normalize(partName),
  );

  const exactMatch = PART_PROFILES.find((profile) => {
    const names = [
      profile.canonicalName,
      ...profile.aliases,
    ].map((name) => singularizeSimple(normalize(name)));

    return names.includes(normalizedPart);
  });

  if (exactMatch) {
    return exactMatch;
  }

  // Do not use a partial profile match here. "Tankgeber" is not a tank,
  // "Tankdeckel" is not a tank and "Scheinwerferhalter" is not a
  // complete headlight. Broad substring matching caused accessory prices to
  // overwrite the value of the actual dismantling part.

  /*
   * Generisches Profil:
   * Unbekannte Teile funktionieren trotzdem sofort.
   * Später kann dafür bei Bedarf ein genaueres Profil ergänzt werden.
   */
  return {
    id: `generic-${normalizedPart.replace(/\s+/g, "-")}`,
    canonicalName: partName,

    aliases: [
      partName,
      ...partName.split(/\s*\/\s*/).map((value) => value.trim()).filter(Boolean),
    ],
    searchTerms: partName
      .split(/\s*\/\s*/)
      .map((value) => value
        .replace(/\bkomplett\b/gi, "")
        .replace(/\boriginal\b/gi, "")
        .replace(/\bzubehör\b/gi, "")
        .replace(/\bmit papieren\b/gi, "")
        .replace(/\bsatz\b/gi, "")
        .replace(/\s+/g, " ")
        .trim())
      .filter(Boolean),

    excludeTerms: [
      "reparatur",
      "reparatursatz",
      "dichtsatz",
      "aufkleber",
      "halter einzeln",
      "halterung einzeln",
      "befestigung einzeln",
      "schrauben",
      "schraubensatz",
      "miniatur",
      "modellbau",
      "gesuch",
      "suche",
      "gesucht",
    ],

    minPrice: 5,
    maxPrice: 20_000,

    conditionTerms: COMMON_CONDITION_TERMS,
  };
}

export function detectMarketCondition(
  title: string,
  profile: PartProfile,
): MarketCondition {
  const normalizedTitle = normalize(title);

  if (
    profile.conditionTerms.damaged.some((term) =>
      normalizedTitle.includes(normalize(term)),
    )
  ) {
    return "damaged";
  }

  if (
    profile.conditionTerms.newOldStock.some((term) =>
      normalizedTitle.includes(normalize(term)),
    )
  ) {
    return "new-old-stock";
  }

  if (
    profile.conditionTerms.refurbished.some((term) =>
      normalizedTitle.includes(normalize(term)),
    )
  ) {
    return "refurbished";
  }

  if (normalizedTitle.length > 0) {
    return "used";
  }

  return "unknown";
}

export function shouldExcludeListing(
  title: string,
  profile: PartProfile,
): {
  excluded: boolean;
  matchedTerm?: string;
} {
  const normalizedTitle = normalize(title);

  for (const excludeTerm of profile.excludeTerms) {
    const normalizedExcludeTerm = normalize(excludeTerm);

    if (
      normalizedExcludeTerm &&
      normalizedTitle.includes(normalizedExcludeTerm)
    ) {
      return {
        excluded: true,
        matchedTerm: excludeTerm,
      };
    }
  }

  return {
    excluded: false,
  };
}
