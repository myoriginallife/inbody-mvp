export function DatabaseUnavailableNotice() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-amber-900">데이터베이스 연결이 필요합니다</h1>
        <p className="mt-3 text-sm leading-6 text-amber-900">
          지금은 앱 서버는 떠 있지만 PostgreSQL에 연결되지 않아 데이터를 불러올 수 없습니다.
        </p>
        <div className="mt-4 rounded-xl bg-white/70 p-4 text-sm text-amber-950">
          <p className="font-medium">로컬에서 먼저 실행해주세요.</p>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
docker compose up -d
npm run db:migrate
          </pre>
        </div>
      </div>
    </div>
  );
}
