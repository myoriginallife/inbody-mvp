"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "로그인에 실패했습니다"); return; }
      router.push("/dashboard");
      router.refresh();
    } catch { setError("로그인 중 오류가 발생했습니다"); }
    finally { setLoading(false); }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">이메일</label>
        <input name="email" type="email" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500" />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">비밀번호</label>
        <input name="password" type="password" required className="w-full rounded-lg border border-zinc-300 px-3 py-2 outline-none focus:border-emerald-500" />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
        {loading ? "로그인 중..." : "로그인"}
      </button>
    </form>
  );
}
