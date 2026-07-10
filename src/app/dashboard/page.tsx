import { Suspense } from "react";
import { DashboardView } from "@/components/DashboardView";

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-10 text-center text-zinc-500">불러오는 중...</div>}>
      <DashboardView />
    </Suspense>
  );
}
