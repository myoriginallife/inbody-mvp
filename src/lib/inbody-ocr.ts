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

const FIELD_KEYS: (keyof OcrFields)[] = [
  "weight",
  "skeletalMuscle",
  "bodyFatPercent",
  "bodyFatMass",
  "bmi",
  "visceralFat",
  "basalMetabolicRate",
];

function normalizeOcrText(raw: string) {
  let text = raw
    .replace(/\r/g, "\n")
    .replace(/[|]/g, " ")
    .replace(/㎏/g, "kg")
    .replace(/％/g, "%")
    .replace(/[．]/g, ".");

  // Common Korean OCR misreads for InBody labels
  const replacements: Array<[RegExp, string]> = [
    [/체\s*중/gi, "체중"],
    [/체\s*지\s*방\s*률|체지반률|체지방를|체자방률|체지망률/gi, "체지방률"],
    [/체\s*지\s*방\s*량|체지반량|체자방량|체지망량/gi, "체지방량"],
    [/골격\s*근\s*량|골갹근량|골걱근량|골격근랑/gi, "골격근량"],
    [/기초\s*대\s*사\s*량|기초네사량|기초대샤량/gi, "기초대사량"],
    [/내장\s*지\s*방(?:\s*레\s*벨)?|네장지방|내장자방/gi, "내장지방"],
    [/체\s*질\s*량\s*지\s*수|체질량지스/gi, "체질량지수"],
    [/Skeletal\s*Muscle\s*Mass/gi, "SMM"],
    [/Percent\s*Body\s*Fat/gi, "PBF"],
    [/Body\s*Fat\s*Mass/gi, "BFM"],
    [/Basal\s*Metabolic\s*Rate/gi, "BMR"],
    [/Visceral\s*Fat(?:\s*Level)?/gi, "VFL"],
  ];

  for (const [pattern, value] of replacements) {
    text = text.replace(pattern, value);
  }

  // Fix digit-like OCR errors only around numbers
  text = text.replace(/(\d)[OoＯ](\d)/g, "$10$2");
  text = text.replace(/(\d)[OoＯ]\b/g, "$10");
  text = text.replace(/\b[OoＯ](\d)/g, "0$1");
  text = text.replace(/(\d)[lI|](\d)/g, "$11$2");

  return text;
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

  // Prefer most frequent value among valid candidates
  const counts = new Map<number, number>();
  for (const v of valid) {
    const key = Math.round(v * 10) / 10;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let best = valid[0];
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }

  const withDecimal = valid.filter((v) => !Number.isInteger(v));
  if (bestCount === 1 && withDecimal.length > 0) return withDecimal[0];
  return best;
}

function findNearLabel(text: string, labels: RegExp[], numberPattern: RegExp) {
  for (const label of labels) {
    const nearby = new RegExp(
      `${label.source}[^\\d\\n]{0,40}(${numberPattern.source})`,
      "gi",
    );
    const m1 = nearby.exec(text);
    if (m1?.[1]) {
      const num = parseNum(m1[1]);
      if (num !== undefined) return num;
    }

    const multiline = new RegExp(
      `${label.source}[^\\S\\n]{0,20}\\n[^\\S\\n]{0,20}(${numberPattern.source})`,
      "gi",
    );
    const m2 = multiline.exec(text);
    if (m2?.[1]) {
      const num = parseNum(m2[1]);
      if (num !== undefined) return num;
    }

    // number before label (some layouts)
    const before = new RegExp(
      `(${numberPattern.source})[^\\d\\n]{0,12}${label.source}`,
      "gi",
    );
    const m3 = before.exec(text);
    if (m3?.[1]) {
      const num = parseNum(m3[1]);
      if (num !== undefined) return num;
    }
  }
  return undefined;
}

function scoreResult(result: OcrParseResult) {
  const required = ["weight", "skeletalMuscle", "bodyFatPercent", "bmi"] as const;
  return required.reduce((sum, key) => sum + (result[key] != null ? 2 : 0), 0) + result.foundFields.length;
}

export function parseInbodyOcrText(rawText: string): OcrParseResult {
  const normalized = normalizeOcrText(rawText);
  const text = normalized.replace(/[ \t]+/g, " ");
  const multiline = normalized;

  const weight =
    findNearLabel(multiline, [/체중/, /\bWeight\b/, /\bWT\b/], /\d{2,3}(?:\.\d{1,2})?/) ??
    preferValue(
      collectMatches(text, [
        /체중[^\d]{0,24}(\d{2,3}(?:\.\d{1,2})?)/gi,
        /\bWeight\b[^\d]{0,24}(\d{2,3}(?:\.\d{1,2})?)/gi,
      ]),
      30,
      300,
    );

  const skeletalMuscle =
    findNearLabel(
      multiline,
      [/골격근량/, /\bSMM\b/, /Skeletal\s*Muscle/],
      /\d{1,2}(?:\.\d{1,2})?/,
    ) ??
    preferValue(
      collectMatches(text, [
        /골격근량[^\d]{0,24}(\d{1,2}(?:\.\d{1,2})?)/gi,
        /\bSMM\b[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
      ]),
      10,
      80,
    );

  const bodyFatPercent =
    findNearLabel(
      multiline,
      [/체지방률/, /\bPBF\b/, /Percent\s*Body\s*Fat/],
      /\d{1,2}(?:\.\d{1,2})?/,
    ) ??
    preferValue(
      collectMatches(text, [
        /체지방률[^\d]{0,24}(\d{1,2}(?:\.\d{1,2})?)\s*%?/gi,
        /\bPBF\b[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
      ]),
      3,
      60,
    );

  const bodyFatMass =
    findNearLabel(
      multiline,
      [/체지방량/, /\bBFM\b/, /Body\s*Fat\s*Mass/],
      /\d{1,2}(?:\.\d{1,2})?/,
    ) ??
    preferValue(
      collectMatches(text, [
        /체지방량[^\d]{0,24}(\d{1,2}(?:\.\d{1,2})?)/gi,
        /\bBFM\b[^\d]{0,16}(\d{1,2}(?:\.\d{1,2})?)/gi,
      ]),
      1,
      150,
    );

  const bmi =
    findNearLabel(multiline, [/\bBMI\b/, /체질량지수/], /\d{1,2}(?:\.\d{1,2})?/) ??
    preferValue(
      collectMatches(text, [
        /\bBMI\b[^\d]{0,24}(\d{1,2}(?:\.\d{1,2})?)/gi,
        /체질량지수[^\d]{0,24}(\d{1,2}(?:\.\d{1,2})?)/gi,
      ]),
      10,
      60,
    );

  const visceralFatRaw =
    findNearLabel(multiline, [/내장지방(?:레벨)?/, /\bVFL\b/], /\d{1,2}/) ??
    preferValue(
      collectMatches(text, [
        /내장지방(?:레벨)?[^\d]{0,24}(\d{1,2})/gi,
        /\bVFL\b[^\d]{0,16}(\d{1,2})/gi,
      ]),
      1,
      30,
    );

  const basalMetabolicRate =
    findNearLabel(multiline, [/기초대사량/, /\bBMR\b/], /\d{3,4}/) ??
    preferValue(
      collectMatches(text, [
        /기초대사량[^\d]{0,24}(\d{3,4})/gi,
        /\bBMR\b[^\d]{0,16}(\d{3,4})/gi,
      ]),
      800,
      4000,
    );

  let derivedBodyFatMass = bodyFatMass;
  if (derivedBodyFatMass == null && weight != null && bodyFatPercent != null) {
    const derived = Math.round(((weight * bodyFatPercent) / 100) * 10) / 10;
    if (derived >= 1 && derived <= 150) derivedBodyFatMass = derived;
  }

  let finalBmi = bmi;
  if (finalBmi == null && weight != null) {
    const heightMatch = multiline.match(/키[^\d]{0,12}(\d{3}(?:\.\d)?)/);
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

  const foundFields = FIELD_KEYS.filter((key) => fields[key] !== undefined);
  const requiredFound = ["weight", "skeletalMuscle", "bodyFatPercent", "bmi"].filter((k) =>
    foundFields.includes(k as keyof OcrFields),
  ).length;
  const confidence =
    requiredFound >= 4 ? "high" : requiredFound >= 2 ? "partial" : "low";

  return {
    ...fields,
    foundFields,
    confidence,
    rawTextPreview: normalized.slice(0, 400),
  };
}

/** Merge multiple OCR parse results (best coverage wins per field). */
export function mergeOcrResults(results: OcrParseResult[]): OcrParseResult {
  if (results.length === 0) {
    return { foundFields: [], confidence: "low" };
  }

  const merged: OcrFields = {};
  for (const key of FIELD_KEYS) {
    const candidates = results
      .map((r) => r[key])
      .filter((v): v is number => typeof v === "number");
    if (candidates.length === 0) continue;

    const ranges: Record<keyof OcrFields, [number, number]> = {
      weight: [30, 300],
      skeletalMuscle: [10, 80],
      bodyFatPercent: [3, 60],
      bodyFatMass: [1, 150],
      bmi: [10, 60],
      visceralFat: [1, 30],
      basalMetabolicRate: [800, 4000],
    };
    const [min, max] = ranges[key];
    merged[key] = preferValue(candidates, min, max);
  }

  const foundFields = FIELD_KEYS.filter((key) => merged[key] !== undefined);
  const requiredFound = ["weight", "skeletalMuscle", "bodyFatPercent", "bmi"].filter((k) =>
    foundFields.includes(k as keyof OcrFields),
  ).length;
  const confidence =
    requiredFound >= 4 ? "high" : requiredFound >= 2 ? "partial" : "low";

  const bestPreview = [...results].sort((a, b) => scoreResult(b) - scoreResult(a))[0]
    ?.rawTextPreview;

  return { ...merged, foundFields, confidence, rawTextPreview: bestPreview };
}
