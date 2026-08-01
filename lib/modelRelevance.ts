export type ModelRelevanceMetadata = {
  brand: string;
  model: string;
  motorcycleFamily: string;
  seriesVariant: string;
  year: string;
  motorcycleFuel: string;
  motorcycleCooling: string;
};

function descriptor(metadata: Pick<ModelRelevanceMetadata, "brand" | "model" | "motorcycleFamily" | "seriesVariant" | "year">) {
  return [metadata.brand, metadata.model, metadata.motorcycleFamily, metadata.seriesVariant, metadata.year]
    .filter(Boolean)
    .join(" ")
    .toLocaleUpperCase("de-DE");
}

export function clearlyNakedMotorcycle(metadata: Pick<ModelRelevanceMetadata, "brand" | "model" | "motorcycleFamily" | "seriesVariant" | "year">) {
  const text = descriptor(metadata);
  if (/\bSV\s*1000N\b|\bSV\s*650N\b/.test(text)) return true;
  return /\b(MONSTER|SPEED TRIPLE|STREET TRIPLE|XJR|ER-5|CB500|CB 500|GSX1400|GSX 1400|B-KING|MT-01|MT-03|BONNEVILLE|SCRAMBLER|THRUXTON|GRISO|BREVA|SUPER DUKE|DUKE)\b/.test(text);
}

export function fairingIsValueCritical(metadata: Pick<ModelRelevanceMetadata, "brand" | "model" | "motorcycleFamily" | "seriesVariant" | "year">) {
  const text = descriptor(metadata);
  if (clearlyNakedMotorcycle(metadata)) return false;
  return /(GSX[ -]?R|CBR|FZR|YZF|ZZR|ZX[ -]?\d|NINJA|DAYTONA|VFR|RVF|NSR|RSV|PANIGALE|HAYABUSA|GSX1300R|TL1000R|GOLD WING|PAN EUROPEAN|DEAUVILLE|FJR|\bGTR\d|TROPHY|SPRINT ST|K1100LT|K1200LT)/.test(text)
    || /\bSV\s*1000S\b|\bSV\s*650S\b/.test(text);
}

export function drivetrainHint(metadata: Pick<ModelRelevanceMetadata, "brand" | "model" | "motorcycleFamily" | "seriesVariant" | "year">): "chain" | "shaft" | "belt" | "unknown" {
  const text = descriptor(metadata);
  if (/HARLEY-DAVIDSON|XLH|SPORTSTER|DYNA|SOFTAIL|ROAD KING|ELECTRA GLIDE|STREET GLIDE|ROAD GLIDE/.test(text)) return "belt";
  if (/MOTO GUZZI|\bBMW K(?:75|100|1100|1200|1300)[A-Z]*\b|\bBMW R(?:850|1000|1100|1150|1200)[A-Z ]*\b|GOLD WING|PAN EUROPEAN|DEAUVILLE|NTV650|CX500|CX650|FJR1300|GTR1000|GTR1400|XJ900|V-MAX 1200|V MAX 1200|ROCKET III/.test(text)) return "shaft";
  if (/(GSX[ -]?R|CBR|FZR|YZF|ZZR|NINJA|BANDIT|HORNET|MONSTER|SPEED TRIPLE|STREET TRIPLE|XJR|ER-5|CB500|SV650|SV1000|DAYTONA|VFR|RSV|PANIGALE|HAYABUSA|SUPER DUKE)/.test(text)) return "chain";
  return "unknown";
}

export function automaticallyIrrelevantPartNames(metadata: ModelRelevanceMetadata) {
  const fuel = metadata.motorcycleFuel.toLocaleLowerCase("de-DE");
  const cooling = metadata.motorcycleCooling.toLocaleLowerCase("de-DE");
  const year = Number(metadata.year || 0);
  const irrelevant = new Set<string>();

  if (fuel.includes("vergaser")) irrelevant.add("Einspritzdüsen");
  if (fuel.includes("einspritz")) irrelevant.add("Vergaseranlage komplett");

  // Nur sehr sichere Zeitgrenzen. Dazwischen bleibt die Entscheidung bewusst offen.
  if (!fuel && year > 0 && year <= 1979) irrelevant.add("Einspritzdüsen");
  if (!fuel && year >= 2009) irrelevant.add("Vergaseranlage komplett");

  if (cooling.includes("luft")) {
    ["Kühler", "Kühlerventilator", "Kühlerausgleichsbehälter", "Thermostat / Thermostatgehäuse"].forEach((name) => irrelevant.add(name));
  }

  if (clearlyNakedMotorcycle(metadata)) {
    ["Verkleidungssatz komplett", "Kanzel / Frontmaske", "Seitenverkleidung links", "Seitenverkleidung rechts", "Bugspoiler", "Windschutzscheibe", "Innenverkleidung / Abdeckungen"].forEach((name) => irrelevant.add(name));
  }

  const drive = drivetrainHint(metadata);
  if (drive === "shaft") ["Kettensatz", "Kettenradträger / Ruckdämpfer", "Kettenschutz"].forEach((name) => irrelevant.add(name));
  if (drive === "chain") irrelevant.add("Kardan / Endantrieb");
  if (drive === "belt") ["Kettensatz", "Kettenradträger / Ruckdämpfer", "Kettenschutz", "Kardan / Endantrieb"].forEach((name) => irrelevant.add(name));

  return irrelevant;
}
