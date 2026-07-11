"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveProfile } from "@/lib/client-storage";
import { ACTIVITY_LEVELS, GENDERS, GOALS, profileSchema } from "@/lib/validations";

export function OnboardingForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const parsed = profileSchema.safeParse({
      gender: form.get("gender"),
      age: form.get("age"),
      height: form.get("height"),
      goal: form.get("goal"),
      activityLevel: form.get("activityLevel"),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다");
      setLoading(false);
      return;
    }
    saveProfile(parsed.data);
    router.push("/inbody/new");
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1 block text-sm font-medium">성별</label>
        <select name="gender" required className="w-full rounded-lg border border-zinc-300 px-3 py-2" defaultValue="male">
          {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium">나이</label>
          <input name="age" type="number" required min={14} max={100} className="w-full rounded-lg border border-zinc-300 px-3 py-2" placeholder="30" />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">키 (cm)</label>
          <input name="height" type="number" required min={100} max={250} step="0.1" className="w-full rounded-lg border border-zinc-300 px-3 py-2" placeholder="170" />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">목표</label>
        <select name="goal" required className="w-full rounded-lg border border-zinc-300 px-3 py-2">
          {GOALS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium">활동 수준</label>
        <select name="activityLevel" required className="w-full rounded-lg border border-zinc-300 px-3 py-2">
          {ACTIVITY_LEVELS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={loading} className="w-full rounded-lg bg-emerald-600 py-3 font-medium text-white hover:bg-emerald-700 disabled:opacity-60">
        {loading ? "저장 중..." : "다음: 인바디 입력"}
      </button>
    </form>
  );
}
