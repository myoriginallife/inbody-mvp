import type { ComparisonResult } from "@/lib/comparison";

const trendStyles = {
  positive: "text-emerald-700 bg-emerald-50",
  negative: "text-red-700 bg-red-50",
  neutral: "text-zinc-600 bg-zinc-50",
};

const trendLabels = {
  positive: "좋은 변화",
  negative: "주의",
  neutral: "유지",
};

export function ComparisonSection({ comparison }: { comparison: ComparisonResult }) {
  return (
    <section className="mt-6 rounded-2xl border border-blue-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-blue-800">이전 측정과 비교</h2>
        <span className="text-xs text-zinc-500">
          기준: {comparison.previousDate.toLocaleDateString("ko-KR")} ({comparison.daysBetween}일 전)
        </span>
      </div>
      <p className="mt-2 text-sm text-zinc-700">{comparison.summary}</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {comparison.items.map((item) => (
          <div key={item.key} className="rounded-xl border border-zinc-100 p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-zinc-700">{item.label}</p>
              <span className={`rounded-full px-2 py-0.5 text-xs ${trendStyles[item.trend]}`}>
                {trendLabels[item.trend]}
              </span>
            </div>
            <p className="mt-2 text-lg font-semibold">
              {item.current}
              {item.unit}
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              이전 {item.previous}
              {item.unit} →{" "}
              <span className={item.trend === "positive" ? "text-emerald-700" : item.trend === "negative" ? "text-red-600" : ""}>
                {item.delta > 0 ? "+" : ""}
                {item.delta}
                {item.unit}
              </span>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
