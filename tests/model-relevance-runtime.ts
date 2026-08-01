import { automaticallyIrrelevantPartNames, clearlyNakedMotorcycle, drivetrainHint, fairingIsValueCritical, type ModelRelevanceMetadata } from "../lib/modelRelevance";

function metadata(overrides: Partial<ModelRelevanceMetadata>): ModelRelevanceMetadata {
  return {
    brand: "",
    model: "",
    motorcycleFamily: "",
    seriesVariant: "",
    year: "",
    motorcycleFuel: "",
    motorcycleCooling: "",
    ...overrides,
  };
}
function expect(value: boolean, message: string) { if (!value) throw new Error(message); }

const svN = metadata({ brand: "Suzuki", model: "SV1000", seriesVariant: "SV1000N", year: "2004" });
expect(clearlyNakedMotorcycle(svN), "SV1000N wurde nicht als Naked erkannt.");
expect(!fairingIsValueCritical(svN), "SV1000N verlangt fälschlich einen Verkleidungssatz.");
expect(automaticallyIrrelevantPartNames(svN).has("Verkleidungssatz komplett"), "SV1000N blendet die Vollverkleidung nicht aus.");
expect(automaticallyIrrelevantPartNames(svN).has("Kardan / Endantrieb"), "SV1000N blendet den Kardan nicht aus.");

const gsxr = metadata({ brand: "Suzuki", model: "GSX-R750", motorcycleFamily: "GSX-R", year: "1999" });
expect(fairingIsValueCritical(gsxr), "GSX-R750 behandelt die Verkleidung nicht als Hauptteil.");
expect(drivetrainHint(gsxr) === "chain", "GSX-R750 wurde nicht als Kettenantrieb erkannt.");

const bmw = metadata({ brand: "BMW", model: "K1100LT", motorcycleFamily: "K", year: "1994" });
expect(drivetrainHint(bmw) === "shaft", "BMW K1100LT wurde nicht als Kardan erkannt.");
expect(automaticallyIrrelevantPartNames(bmw).has("Kettensatz"), "BMW K1100LT blendet Kettenteile nicht aus.");
expect(fairingIsValueCritical(bmw), "BMW K1100LT behandelt die Verkleidung nicht als Hauptteil.");

const harley = metadata({ brand: "Harley-Davidson", model: "XLH 1200 Sportster", year: "2005" });
expect(drivetrainHint(harley) === "belt", "Sportster wurde nicht als Riemenantrieb erkannt.");
expect(automaticallyIrrelevantPartNames(harley).has("Kettensatz") && automaticallyIrrelevantPartNames(harley).has("Kardan / Endantrieb"), "Sportster blendet falsche Antriebspositionen nicht aus.");

const classic = metadata({ brand: "Honda", model: "CB750", year: "1978" });
expect(automaticallyIrrelevantPartNames(classic).has("Einspritzdüsen"), "1978er Motorrad blendet Einspritzdüsen nicht aus.");

const modern = metadata({ brand: "Honda", model: "CBR1000RR Fireblade", year: "2009" });
expect(automaticallyIrrelevantPartNames(modern).has("Vergaseranlage komplett"), "2009er Sportmotorrad blendet Vergaser nicht aus.");

const unknown = metadata({ brand: "Unbekannt", model: "Sondermodell", year: "1995" });
expect(drivetrainHint(unknown) === "unknown", "Unbekanntes Modell wurde zu aggressiv klassifiziert.");
expect(!automaticallyIrrelevantPartNames(unknown).has("Kardan / Endantrieb"), "Unbekanntes Modell blendet Kardan fälschlich aus.");

console.log("MODEL_RELEVANCE_OK (6 Modellgruppen)");
