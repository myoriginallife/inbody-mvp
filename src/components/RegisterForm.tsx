"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ConsentNotice } from "@/components/ConsentNotice";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password"), consent: form.get("consent") === "on" }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "회원가입에 실패했습니다"); return; }
      router.push("/onboarding");
      router.refresh();
    } catch { setError("회원가입 중 오류가 발생했습니다"); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">이메일</label>
        <input name="email" type="email" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500" placeholder="you@example.com" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">비밀번호</label>
        <input name="password" type="password" required minLength={8} className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500" placeholder="8자 이상" />
      </div>
      <ConsentNotice />
      <label className="flex items-start gap-2 text-sm">
        <input name="consent" type="checkbox" className="mt-1" required />
        <span>개인정보 및 건강정보 수집·이용에 동의합니다. (필수)</span>
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
        {loading ? "가입 중..." : "회원가입"}
      </button>
    </form>
  );
}
