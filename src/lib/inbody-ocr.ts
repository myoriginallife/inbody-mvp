export type OcrFields = {
  weight?: number;
  skeletalMuscle?: number;
  bodyFatPercent?: number;
  bodyFatMass?: number;
  bmi?: number;
  visceralFat?: number;
  basalMetabolicRate?: number;
};

export type OcrParseResult = OcrFields & {
  foundFields: (keyof OcrFields)[];
  confidence: "high" | "partial" | "low";
};

function parseNum(value: string) {
  const n = parseFloat(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const num = parseNum(match[1]);
      if (num !== undefined) return num;
    }
  }
  return undefined;
}

function inRange(value: number | undefined, min: number, max: number) {
  return value !== undefined && value >= min && value <= max;
}

export function parseInbodyOcrText(rawText: string): OcrParseResult {
  const text = rawText.replace(/\r/g, "\n").replace(/[|]/g, " ").replace(/\s+/g, " ");
  const multiline = rawText.replace(/\r/g, "\n");

  const weight = firstMatch(text, [
    /체\s*중[^\d]{0,12}(\d{2,3}\.?\d*)\s*(?:kg|KG|킬로)?/i,
    /Weight[^\d]{0,12}(\d{2,3}\.?\d*)/i,
  ]);

  const skeletalMuscle = firstMatch(text, [
    /골격\s*근\s*량[^\d]{0,12}(\d{2}\.?\d*)/i,
    /Skeletal\s*Muscle\s*Mass[^\d]{0,12}(\d{2}\.?\d*)/i,
    /SMM[^\d]{0,8}(\d{2}\.?\d*)/i,
  ]);

  const bodyFatPercent = firstMatch(text, [
    /체\s*지\s*방\s*률[^\d]{0,12}(\d{1,2}\.?\d*)\s*%?/i,
    /Percent\s*Body\s*Fat[^\d]{0,12}(\d{1,2}\.?\d*)/i,
    /PBF[^\d]{0,8}(\d{1,2}\.?\d*)/i,
  ]);

  const bodyFatMass = firstMatch(text, [
    /체\s*지\s*방\s*량[^\d]{0,12}(\d{1,2}\.?\d*)\s*(?:kg|KG)?/i,
    /Body\s*Fat\s*Mass[^\d]{0,12}(\d{1,2}\.?\d*)/i,
    /BFM[^\d]{0,8}(\d{1,2}\.?\d*)/i,
  ]);

  const bmi = firstMatch(text, [
    /BMI[^\d]{0,12}(\d{1,2}\.?\d*)/i,
    /체\s*질\s*량\s*지\s*수[^\d]{0,12}(\d{1,2}\.?\d*)/i,
  ]);

  const visceralFat = firstMatch(multiline, [
    /내장\s*지\s*방(?:\s*레\s*벨)?[^\d]{0,12}(\d{1,2})/i,
    /Visceral\s*Fat\s*Level[^\d]{0,12}(\d{1,2})/i,
    /VFL[^\d]{0,8}(\d{1,2})/i,
  ]);

  const basalMetabolicRate = firstMatch(text, [
    /기초\s*대\s*사\s*량[^\d]{0,12}(\d{3,4})/i,
    /Basal\s*Metabolic\s*Rate[^\d]{0,12}(\d{3,4})/i,
    /BMR[^\d]{0,8}(\d{3,4})/i,
  ]);

  const fields: OcrFields = {
    weight: inRange(weight, 30, 300) ? weight : undefined,
    skeletalMuscle: inRange(skeletalMuscle, 10, 80) ? skeletalMuscle : undefined,
    bodyFatPercent: inRange(bodyFatPercent, 3, 60) ? bodyFatPercent : undefined,
    bodyFatMass: inRange(bodyFatMass, 1, 150) ? bodyFatMass : undefined,
    bmi: inRange(bmi, 10, 60) ? bmi : undefined,
    visceralFat: inRange(visceralFat, 1, 30) ? Math.round(visceralFat!) : undefined,
    basalMetabolicRate: inRange(basalMetabolicRate, 800, 4000)
      ? Math.round(basalMetabolicRate!)
      : undefined,
  };

  const foundFields = (Object.keys(fields) as (keyof OcrFields)[]).filter(
    (key) => fields[key] !== undefined,
  );

  const requiredFound = ["weight", "skeletalMuscle", "bodyFatPercent", "bmi"].filter((k) =>
    foundFields.includes(k as keyof OcrFields),
  ).length;

  const confidence =
    requiredFound >= 4 ? "high" : requiredFound >= 2 ? "partial" : "low";

  return { ...fields, foundFields, confidence };
}
