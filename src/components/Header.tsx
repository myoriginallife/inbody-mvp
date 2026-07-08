import Link from "next/link";
import { getSession } from "@/lib/auth";

export async function Header() {
  const session = await getSession();
  return (
    <header className="border-b border-emerald-100 bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-bold text-emerald-700">InBody Fit</Link>
        <nav className="flex items-center gap-3 text-sm">
          {session ? (
            <>
              <Link href="/dashboard" className="text-zinc-600 hover:text-emerald-700">대시보드</Link>
              <Link href="/inbody/new" className="rounded-full bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">인바디 입력</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="text-zinc-600 hover:text-emerald-700">로그인</Link>
              <Link href="/register" className="rounded-full bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">시작하기</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
