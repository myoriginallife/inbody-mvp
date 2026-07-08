import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { compareWithPrevious } from "@/lib/comparison";
import { prisma } from "@/lib/db";
import type { DietPlan, ExercisePlan } from "@/lib/recommendations";
import type { Goal } from "@/lib/validations";
import { ComparisonSection } from "@/components/ComparisonSection";
import { LogoutButton } from "@/components/LogoutButton";
import { ConsentNotice } from "@/components/ConsentNotice";

type Props = { searchParams: Promise<{ record?: string }> };

export default async function DashboardPage({ searchParams }: Props) {
  const session = await getSession();
  if (!session) redirect("/login");
  const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
  if (!profile) redirect("/onboarding");
  const params = await searchParams;
  const records = await prisma.inbodyRecord.findMany({ where: { userId: session.userId }, orderBy: { createdAt: "desc" } });
  const record = records.find((r) => r.id === params.record) ?? records[0] ?? null;

  if (!record) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold">아직 인바디 기록이 없습니다</h1>
        <p className="mt-3 text-zinc-600">첫 인바디 결과를 입력하고 맞춤 추천을 받아보세요.</p>
        <Link href="/inbody/new" className="mt-6 inline-block rounded-full bg-emerald-600 px-6 py-3 font-medium text-white hover:bg-emerald-700">인바디 입력하기</Link>
      </div>
    );
  }

  const dietPlan = JSON.parse(record.dietPlan) as DietPlan;
  const exercisePlan = JSON.parse(record.exercisePlan) as ExercisePlan;
  const rationales = JSON.parse(record.rationales) as string[];

  const currentIndex = records.findIndex((r) => r.id === record.id);
  const previousRecord = currentIndex >= 0 ? records[currentIndex + 1] : null;
  const comparison =
    previousRecord && profile
      ? compareWithPrevious(
          {
            weight: record.weight,
            skeletalMuscle: record.skeletalMuscle,
            bodyFatPercent: record.bodyFatPercent,
            bodyFatMass: record.bodyFatMass,
            bmi: record.bmi,
            visceralFat: record.visceralFat,
            createdAt: record.createdAt,
          },
          {
            weight: previousRecord.weight,
            skeletalMuscle: previousRecord.skeletalMuscle,
            bodyFatPercent: previousRecord.bodyFatPercent,
            bodyFatMass: previousRecord.bodyFatMass,
            bmi: previousRecord.bmi,
            visceralFat: previousRecord.visceralFat,
            createdAt: previousRecord.createdAt,
          },
          profile.goal as Goal,
        )
      : null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">맞춤 추천 대시보드</h1>
          <p className="mt-1 text-sm text-zinc-500">{session.email}</p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/inbody/new" className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">새 인바디 입력</Link>
          <LogoutButton />
        </div>
      </div>
      <section className="mt-8 rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-emerald-800">체성분 요약</h2>
          <span className="text-xs text-zinc-500">{new Date(record.createdAt).toLocaleDateString("ko-KR")}</span>
        </div>
        <p className="mt-3 text-zinc-700">{record.summary}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[{ label: "체중", value: `${record.weight} kg` }, { label: "골격근량", value: `${record.skeletalMuscle} kg` }, { label: "체지방률", value: `${record.bodyFatPercent} %` }, { label: "BMI", value: record.bmi }].map((item) => (
            <div key={item.label} className="rounded-xl bg-emerald-50 px-4 py-3 text-center">
              <p className="text-xs text-emerald-700">{item.label}</p>
              <p className="mt-1 text-lg font-semibold">{item.value}</p>
            </div>
          ))}
        </div>
        {record.imagePath && (
          <div className="mt-6">
            <p className="mb-2 text-sm font-medium text-zinc-600">업로드한 결과지</p>
            <Image src={record.imagePath} alt="인바디 결과지" width={400} height={300} className="max-h-64 rounded-lg border object-contain" />
          </div>
        )}
      </section>
      {comparison && <ComparisonSection comparison={comparison} />}
      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold">추천 근거</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">{rationales.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-800">{dietPlan.title}</h2>
          <p className="mt-2 text-sm text-zinc-600">하루 목표 칼로리: <strong>{dietPlan.dailyCalories} kcal</strong></p>
          <div className="mt-4 flex gap-4 text-sm"><span>단백질 {dietPlan.protein}</span><span>탄수 {dietPlan.carbs}</span><span>지방 {dietPlan.fat}</span></div>
          <h3 className="mt-5 text-sm font-semibold">식단 예시</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">{dietPlan.meals.map((meal) => <li key={meal}>{meal}</li>)}</ul>
          <h3 className="mt-5 text-sm font-semibold">식이 팁</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">{dietPlan.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </section>
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-emerald-800">{exercisePlan.title}</h2>
          <p className="mt-2 text-sm text-zinc-600">권장 빈도: {exercisePlan.weeklyFrequency}</p>
          <div className="mt-4 space-y-4">
            {exercisePlan.sessions.map((s) => (
              <div key={`${s.day}-${s.focus}`} className="rounded-xl bg-zinc-50 p-4">
                <p className="font-medium">{s.day} · {s.focus} <span className="text-sm font-normal text-zinc-500">({s.duration})</span></p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">{s.exercises.map((ex) => <li key={ex}>{ex}</li>)}</ul>
              </div>
            ))}
          </div>
          <h3 className="mt-5 text-sm font-semibold">운동 팁</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">{exercisePlan.tips.map((tip) => <li key={tip}>{tip}</li>)}</ul>
        </section>
      </div>
      {records.length > 1 && (
        <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">측정 이력</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {records.map((r) => (
              <Link key={r.id} href={`/dashboard?record=${r.id}`} className={`rounded-full px-4 py-2 text-sm ${r.id === record.id ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"}`}>
                {new Date(r.createdAt).toLocaleDateString("ko-KR")}
              </Link>
            ))}
          </div>
        </section>
      )}
      <div className="mt-8"><ConsentNotice /></div>
    </div>
  );
}
