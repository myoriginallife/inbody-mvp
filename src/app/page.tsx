import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/db-errors";

export default async function HomePage() {
  const session = await getSession();
  if (session) {
    try {
      const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
      redirect(profile ? "/dashboard" : "/onboarding");
    } catch (error) {
      if (isDatabaseUnavailableError(error)) {
        // 랜딩에서는 DB 연결 실패 시에도 기본 소개 화면을 보여줍니다.
      }
      else {
        throw error;
      }
    }
  }
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <section className="rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 px-8 py-16 text-white shadow-lg">
        <p className="mb-3 text-sm font-medium text-emerald-100">웹 MVP</p>
        <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-5xl">인바디 결과로<br />나에게 맞는 식단·운동을</h1>
        <p className="mt-6 max-w-xl text-lg text-emerald-50">인바디 수치를 입력하면 체성분을 해석하고, 목표에 맞는 식이요법과 주간 운동 루틴을 제안해 드립니다.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/register" className="rounded-full bg-white px-6 py-3 font-semibold text-emerald-700 hover:bg-emerald-50">무료로 시작하기</Link>
          <Link href="/login" className="rounded-full border border-white/40 px-6 py-3 font-medium text-white hover:bg-white/10">로그인</Link>
        </div>
      </section>
      <section className="mt-16 grid gap-6 md:grid-cols-3">
        {[
          { title: "인바디 입력", desc: "결과지 사진 업로드와 핵심 수치 직접 입력을 지원합니다." },
          { title: "체성분 해석", desc: "체지방률, 골격근량, BMI를 바탕으로 현재 상태를 요약합니다." },
          { title: "맞춤 추천", desc: "식단·운동 플랜과 함께 왜 이 추천인지 근거를 보여줍니다." },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-emerald-100 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-emerald-800">{item.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{item.desc}</p>
          </div>
        ))}
      </section>
      <p className="mt-12 text-center text-xs text-zinc-500">본 서비스는 의료 진단·치료를 대체하지 않습니다.</p>
    </div>
  );
}
