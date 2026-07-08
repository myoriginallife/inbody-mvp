import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { OnboardingForm } from "@/components/OnboardingForm";

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (await prisma.profile.findUnique({ where: { userId: session.userId } })) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <h1 className="text-2xl font-bold">기본 정보 입력</h1>
      <p className="mt-2 text-sm text-zinc-600">맞춤 추천을 위해 목표와 활동 수준을 알려주세요.</p>
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><OnboardingForm /></div>
    </div>
  );
}
