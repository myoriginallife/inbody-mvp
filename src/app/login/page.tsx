import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/dashboard");
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-bold">로그인</h1>
      <p className="mt-2 text-sm text-zinc-600">계정이 없으신가요? <Link href="/register" className="text-emerald-700 hover:underline">회원가입</Link></p>
      <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><LoginForm /></div>
    </div>
  );
}
