import type { Goal } from "./validations";

export type InbodyMetrics = {
  weight: number;
  skeletalMuscle: number;
  bodyFatPercent: number;
  bodyFatMass: number | null;
  bmi: number;
  visceralFat: number | null;
  createdAt: Date;
};

export type ComparisonItem = {
  key: string;
  label: string;
  unit: string;
  current: number;
  previous: number;
  delta: number;
  trend: "positive" | "negative" | "neutral";
};

export type ComparisonResult = {
  previousDate: Date;
  daysBetween: number;
  items: ComparisonItem[];
  summary: string;
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function getTrend(metric: string, delta: number, goal: Goal): ComparisonItem["trend"] {
  if (Math.abs(delta) < 0.05) return "neutral";

  const lowerIsBetter = ["weight", "bodyFatPercent", "bodyFatMass", "bmi", "visceralFat"].includes(metric);
  const higherIsBetter = metric === "skeletalMuscle";

  if (goal === "muscle_gain") {
    if (metric === "skeletalMuscle") return delta > 0 ? "positive" : "negative";
    if (lowerIsBetter) return delta < 0 ? "positive" : delta > 0 ? "negative" : "neutral";
  }

  if (goal === "weight_loss" || goal === "body_fat_loss") {
    if (lowerIsBetter) return delta < 0 ? "positive" : "negative";
    if (higherIsBetter) return delta > 0 ? "positive" : "negative";
  }

  if (goal === "maintain") {
    if (Math.abs(delta) <= 0.5) return "neutral";
    return "neutral";
  }

  if (lowerIsBetter) return delta < 0 ? "positive" : "negative";
  if (higherIsBetter) return delta > 0 ? "positive" : "negative";
  return "neutral";
}

function formatDelta(delta: number, unit: string) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${round1(delta)}${unit}`;
}

export function compareWithPrevious(
  current: InbodyMetrics,
  previous: InbodyMetrics,
  goal: Goal,
): ComparisonResult {
  const daysBetween = Math.max(
    1,
    Math.round((current.createdAt.getTime() - previous.createdAt.getTime()) / (1000 * 60 * 60 * 24)),
  );

  const defs = [
    { key: "weight", label: "체중", unit: "kg", get: (r: InbodyMetrics) => r.weight },
    { key: "skeletalMuscle", label: "골격근량", unit: "kg", get: (r: InbodyMetrics) => r.skeletalMuscle },
    { key: "bodyFatPercent", label: "체지방률", unit: "%", get: (r: InbodyMetrics) => r.bodyFatPercent },
    { key: "bmi", label: "BMI", unit: "", get: (r: InbodyMetrics) => r.bmi },
    { key: "bodyFatMass", label: "체지방량", unit: "kg", get: (r: InbodyMetrics) => r.bodyFatMass },
    { key: "visceralFat", label: "내장지방", unit: "레벨", get: (r: InbodyMetrics) => r.visceralFat },
  ];

  const items: ComparisonItem[] = [];
  for (const def of defs) {
    const prevVal = def.get(previous);
    const currVal = def.get(current);
    if (prevVal == null || currVal == null) continue;
    const delta = round1(currVal - prevVal);
    items.push({
      key: def.key,
      label: def.label,
      unit: def.unit,
      current: currVal,
      previous: prevVal,
      delta,
      trend: getTrend(def.key, delta, goal),
    });
  }

  const highlights = items
    .filter((i) => i.trend !== "neutral")
    .slice(0, 3)
    .map((i) => `${i.label} ${formatDelta(i.delta, i.unit)}`)
    .join(", ");

  const summary = highlights
    ? `이전 측정(${daysBetween}일 전) 대비 ${highlights}`
    : `이전 측정(${daysBetween}일 전)과 큰 변화는 없습니다.`;

  return { previousDate: previous.createdAt, daysBetween, items, summary };
}
