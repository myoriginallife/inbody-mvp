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
  rawTextPreview?: string;
};

function normalizeOcrText(raw: string) {
  return raw
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/[OО〇]/g, "0")
    .replace(/[lI|]/g, "1")
    .replace(/[S]/g, (m) => (/\d/.test(m) ? "5" : m))
    .replace(/㎏/g, "kg")
    .replace(/％/g, "%")
    .replace(/체\s*지\s*방\s*률/gi, "체지방률")
    .replace(/체\s*지\s*방\s*량/gi, "체지방량")
    .replace(/골격\s*근\s*량/gi, "골격근량")
    .replace(/기초\s*대\s*사\s*량/gi, "기초대사량")
    .replace(/내장\s*지\s*방/gi, "내장지방")
    .replace(/체\s*중/gi, "체중");
}

function parseNum(value: string) {
  const cleaned = value
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "")
    .replace(/(\..*)\./g, "$1");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : undefined;
}

function collectMatches(text: string, patterns: RegExp[]) {
  const values: number[] = [];
  for (const pattern of patterns) {
    const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
    const global = new RegExp(pattern.source, flags);
    let match: RegExpExecArray | null;
    while ((match = global.exec(text)) !== null) {
      const num = parseNum(match[1] ?? "");
      if (num !== undefined) values.push(num);
    }
  }
  return values;
}

function preferValue(candidates: number[], min: number, max: number) {
  const valid = candidates.filter((v) => v >= min && v <= max);
  if (valid.length === 0) return undefined;
  // Prefer values with decimal places for body metrics when available
  const withDecimal = valid.filter((v) => !Number.isInteger(v));
  const pool = withDecimal.length > 0 ? withDecimal : valid;
  return pool[0];
}

function findNearLabel(text: string, labels: RegExp[], numberPattern: RegExp) {
  for (const label of labels) {
    const re = new RegExp(
      `${label.source}[^\\d\\n]{0,24}(${numberPattern.source})`,
      "i",
    );
    const match = text.match(re);
    if (match?.[1]) {
      const num = parseNum(match[1]);
      if (num !== undefined) return num;
    }

    // Label on previous line, number on next
    const multiline = new RegExp(
      `${label.source}\\s*\\n\\s*(${numberPattern.source})`,
      "i",
    );
    const m2 = text.match(multiline);
    if (m2?.[1]) {
      const num = parseNum(m2[1]);
      if (num !== undefined) return num;
    }
  }
  return undefined;
}

export function parseInbodyOcrText(rawText: string): OcrParseResult {
  const normalized = normalizeOcrText(rawText);
  const text = normalized.replace(/\s+/g, " ");
  const multiline = normalized;

  const weight =
    findNearLabel(multiline, [/체중/, /Weight/, /WT/], /\d{2,3}(?:\.\d{1,2})?/) ??
    preferValue(
      collectMatches(text, [
        /체중[^\d]{0,16}(\d{2,3}(?:\.\d{1,2})?)/gi,
        /Weight[^\d]{0,16}(\d{2,3}(?:\.\d{1,2})?)/gi,
      ]),
      30,
      300,
    );

  const skeletalMuscle =
    findNearLabel(
      multiline,
      [/골격근량/, /Skeletal\s*Muscle(?:\s*Mass)?/, /SMM/],
      /\d{2}(?:\.\d{1,2})?/,
    ) ??
    preferValue(
      collectMatches(text, [
        /골격근량[^\d]{0,16}(\d{2}(?:\.\d{1,2})?)/gi,
        /Skeletal\s*Muscle\s*Mass[^\d]{0,16}(\d{2}(?:\.\d{1,2})?)/gi,
        /SMM[^\d]{0,12}(\d{2}(?:\.\d{1,2})?)/gi,
      ]),
      10,
      80,
    );

  const bodyFatPercent =
    findNearLabel(
      multiline,
      [/체지방률/, /Percent\s*Body\s*Fat/, /PBF/],
      /\d{1,2}(?:\.\d{1,2})?/,
    ) ??
    preferValue(
      collectMatches(text, [
        /체지방률[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)\s*%?/gi,
        /Percent\s*Body\s*Fat[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
        /PBF[^\d]{0,12}(\d{1,2}(?:\.\d{1,2})?)/gi,
      ]),
      3,
      60,
    );

  const bodyFatMass =
    findNearLabel(
      multiline,
      [/체지방량/, /Body\s*Fat\s*Mass/, /BFM/],
      /\d{1,2}(?:\.\d{1,2})?/,
    ) ??
    preferValue(
      collectMatches(text, [
        /체지방량[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
        /Body\s*Fat\s*Mass[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
        /BFM[^\d]{0,12}(\d{1,2}(?:\.\d{1,2})?)/gi,
      ]),
      1,
      150,
    );

  const bmi =
    findNearLabel(multiline, [/\bBMI\b/, /체질량지수/], /\d{1,2}(?:\.\d{1,2})?/) ??
    preferValue(
      collectMatches(text, [
        /\bBMI\b[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
        /체질량지수[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
      ]),
      10,
      60,
    );

  const visceralFatRaw =
    findNearLabel(
      multiline,
      [/내장지방(?:레벨)?/, /Visceral\s*Fat(?:\s*Level)?/, /VFL/],
      /\d{1,2}/,
    ) ??
    preferValue(
      collectMatches(text, [
        /내장지방(?:레벨)?[^\d]{0,16}(\d{1,2})/gi,
        /Visceral\s*Fat\s*Level[^\d]{0,16}(\d{1,2})/gi,
        /VFL[^\d]{0,12}(\d{1,2})/gi,
      ]),
      1,
      30,
    );

  const basalMetabolicRate =
    findNearLabel(
      multiline,
      [/기초대사량/, /Basal\s*Metabolic\s*Rate/, /\bBMR\b/],
      /\d{3,4}/,
    ) ??
    preferValue(
      collectMatches(text, [
        /기초대사량[^\d]{0,16}(\d{3,4})/gi,
        /Basal\s*Metabolic\s*Rate[^\d]{0,16}(\d{3,4})/gi,
        /\bBMR\b[^\d]{0,12}(\d{3,4})/gi,
      ]),
      800,
      4000,
    );

  // Cross-check: if bodyFatMass missing but weight & % known, derive mass
  let derivedBodyFatMass = bodyFatMass;
  if (derivedBodyFatMass == null && weight != null && bodyFatPercent != null) {
    const derived = Math.round(((weight * bodyFatPercent) / 100) * 10) / 10;
    if (derived >= 1 && derived <= 150) derivedBodyFatMass = derived;
  }

  // Cross-check BMI if missing but weight present and height text found
  let finalBmi = bmi;
  if (finalBmi == null && weight != null) {
    const heightMatch = multiline.match(/키[^\d]{0,10}(\d{3}(?:\.\d)?)/);
    const heightCm = heightMatch?.[1] ? parseNum(heightMatch[1]) : undefined;
    if (heightCm && heightCm >= 100 && heightCm <= 250) {
      const meters = heightCm / 100;
      const computed = Math.round((weight / (meters * meters)) * 10) / 10;
      if (computed >= 10 && computed <= 60) finalBmi = computed;
    }
  }

  const fields: OcrFields = {
    weight: weight != null && weight >= 30 && weight <= 300 ? weight : undefined,
    skeletalMuscle:
      skeletalMuscle != null && skeletalMuscle >= 10 && skeletalMuscle <= 80
        ? skeletalMuscle
        : undefined,
    bodyFatPercent:
      bodyFatPercent != null && bodyFatPercent >= 3 && bodyFatPercent <= 60
        ? bodyFatPercent
        : undefined,
    bodyFatMass:
      derivedBodyFatMass != null && derivedBodyFatMass >= 1 && derivedBodyFatMass <= 150
        ? derivedBodyFatMass
        : undefined,
    bmi: finalBmi != null && finalBmi >= 10 && finalBmi <= 60 ? finalBmi : undefined,
    visceralFat:
      visceralFatRaw != null && visceralFatRaw >= 1 && visceralFatRaw <= 30
        ? Math.round(visceralFatRaw)
        : undefined,
    basalMetabolicRate:
      basalMetabolicRate != null && basalMetabolicRate >= 800 && basalMetabolicRate <= 4000
        ? Math.round(basalMetabolicRate)
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

  return {
    ...fields,
    foundFields,
    confidence,
    rawTextPreview: normalized.slice(0, 280),
  };
}
