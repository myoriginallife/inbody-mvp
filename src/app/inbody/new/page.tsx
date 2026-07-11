import Link from "next/link";
import { InbodyForm } from "@/components/InbodyForm";
import { RequireProfile } from "@/components/RequireProfile";

export default function NewInbodyPage() {
  return (
    <RequireProfile>
      <div className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-2xl font-bold">인바디 결과 입력</h1>
        <p className="mt-2 text-sm text-zinc-600">
          인바디 결과지 사진을 업로드하거나 촬영하면 OCR로 수치를 자동 인식합니다.
        </p>
        <div className="mt-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm"><InbodyForm /></div>
        <p className="mt-4 text-center text-sm"><Link href="/dashboard" className="text-emerald-700 hover:underline">대시보드로 돌아가기</Link></p>
      </div>
    </RequireProfile>
  );
}
