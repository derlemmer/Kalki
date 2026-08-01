import { getPartProfile } from "../database/import/partProfiles";
import { matchListingToPart } from "../lib/partTitleMatcher";

type Case = [partName: string, title: string, expected: boolean];

const cases: Case[] = [
  ["Tank", "Suzuki GSX-R 750 GR7DB EZ:97 Tankhalter Tankbefestigung Benzintank B8302", false],
  ["Tank", "Suzuki GSX-R 750 SRAD GR7DB Benzintank Kraftstofftank rot", true],
  ["Tank", "Suzuki GSXR 750 Srad GR7DB Kühlerausgleichsbehälter ohne Deckel Tank Cooler", false],
  ["Motor komplett", "Suzuki GSX-R 750 SRAD GR7DB Motor Engine Bj.96-97", true],
  ["Motor komplett", "Suzuki GSX-R 750 SRAD EZ:99 Nockenwellensensor Zylinderkopf Motor 59912", false],
  ["Scheinwerfer", "Honda CBR 1000 RR SC57 Scheinwerferhalter Halter", false],
  ["Scheinwerfer", "Honda CBR 1000 RR SC57 Scheinwerfer Hauptscheinwerfer", true],
  ["Seitenverkleidung rechts", "Suzuki GSX-R 750 SRAD GR7DB Seitenverkleidung hinten rechts Seitendeckel", true],
  ["Seitenverkleidung rechts", "Suzuki GSX-R 750 SRAD Seitenverkleidung links", false],
  ["Tankgeber", "Suzuki SV1000S WVBX Tankgeber Benzinstandgeber", true],
  ["Tankgeber", "Suzuki SV1000S WVBX Tank komplett", false],
  ["Tankdeckel", "Honda CBR1000RR SC57 Tankdeckel", true],
  ["Tankdeckel", "Honda CBR1000RR SC57 Tank", false],
  ["Rahmen mit Papieren", "Honda CBR1000RR SC57 Hauptrahmen mit Brief Papieren", true],
  ["Rahmen mit Papieren", "Honda CBR1000RR SC57 Heckrahmen", false],
  ["Auspuffanlage komplett", "Suzuki SV1000S WVBX Auspuffanlage komplett Krümmer Endschalldämpfer", true],
  ["Auspuffanlage komplett", "Suzuki SV1000S WVBX Auspuffhalter Halterung", false],
  ["Bremsscheiben vorne Satz", "Suzuki GSX-R 750 GR7DB Bremsscheibe vorne links rechts", true],
  ["Bremssättel vorne Satz", "Suzuki GSX-R 750 GR7DB Bremssattel vorne links rechts", true],
  ["Zündspulen Satz", "Honda CBR1000RR SC57 Zündspule 4 Stück Satz", true],
  ["Innenverkleidung / Abdeckungen", "SUZUKI GSX-R 750 SRAD GR7DB Verkleidung innen vorne links", true],
  ["Hinterradabdeckung", "Suzuki GSX-R 750 GR7DB Abdeckung Hinterrad", true],
  ["Motorhalter", "Honda CBR1000RR SC57 Halter Motor links", true],
];

for (const [partName, title, expected] of cases) {
  const result = matchListingToPart(title, partName, getPartProfile(partName));
  if (result.accepted !== expected) {
    throw new Error(`${partName}: ${title} → erwartet ${expected}, erhalten ${result.accepted} (${result.reason})`);
  }
}

const tankProfile = getPartProfile("Tank");
const tankSenderProfile = getPartProfile("Tankgeber");
if (tankProfile.id === tankSenderProfile.id) {
  throw new Error("Tankgeber darf nicht mehr das breite Tank-Profil erhalten.");
}

console.log(`PART_TITLE_TESTS_OK (${cases.length} Fälle)`);
