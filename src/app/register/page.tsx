import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { RegisterForm } from "@/components/RegisterForm";

export default async function RegisterPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">회원가입</h1>
      <p className="mt-2 text-sm text-zinc-600">이미 계정이 있으신가요? <Link href="/login" className="text-emerald-700 hover:underline">로그인</Link></p>
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><RegisterForm /></div>
    </div>
  );
}
