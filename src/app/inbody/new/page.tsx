import Link from "next/link";
import { redirect } from "next/navigation";
import { DatabaseUnavailableNotice } from "@/components/DatabaseUnavailableNotice";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isDatabaseUnavailableError } from "@/lib/db-errors";
import { InbodyForm } from "@/components/InbodyForm";

export default async function NewInbodyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  try {
    if (!(await prisma.profile.findUnique({ where: { userId: session.userId } }))) {
      redirect("/onboarding");
    }
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      return <DatabaseUnavailableNotice />;
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold">인바디 결과 입력</h1>
      <p className="mt-2 text-sm text-zinc-600">인바디 결과지의 핵심 수치를 입력해주세요.</p>
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><InbodyForm /></div>
      <p className="mt-4 text-center text-sm"><Link href="/dashboard" className="text-emerald-700 hover:underline">대시보드로 돌아가기</Link></p>
    </div>
  );
}
