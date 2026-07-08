export function ConsentNotice() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
      <p className="font-semibold">건강정보 이용 안내</p>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li>본 서비스는 일반적인 건강·운동 정보를 제공하며, 의료 진단·치료를 대체하지 않습니다.</li>
        <li>기저질환이 있거나 임신 중인 경우 반드시 전문의와 상담하세요.</li>
        <li>입력하신 인바디 및 건강 정보는 맞춤 추천 목적으로만 사용됩니다.</li>
      </ul>
    </div>
  );
}
