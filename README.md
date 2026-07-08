# InBody Fit (웹 MVP)

인바디 결과를 입력하면 체성분을 해석하고, 목표에 맞는 식이요법·운동 루틴을 제안하는 웹 서비스입니다.

## 기능

- 회원가입 / 로그인 (이메일)
- 개인정보·건강정보 수집 동의
- 온보딩 (성별, 나이, 키, 목표, 활동 수준)
- 인바디 결과 입력 (OCR 자동 인식 + 수동 입력)
- 체성분 요약 및 맞춤 식단·운동 추천
- 이전 측정과 비교

## 기술 스택

- Next.js 16 (App Router)
- TypeScript, Tailwind CSS
- Prisma + PostgreSQL
- Tesseract.js (클라이언트 OCR)
- 규칙 기반 추천 엔진

## 로컬 개발

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 설정

```bash
cp .env.example .env
```

### 3. PostgreSQL 실행 (Docker)

```bash
docker compose up -d
```

### 4. DB 마이그레이션

```bash
npm run db:migrate
```

### 5. 개발 서버 실행

```bash
npm run dev
```

[http://localhost:3000](http://localhost:3000) 에서 확인합니다.

## GitHub 배포 (Vercel)

이 프로젝트는 GitHub 연동 후 Vercel로 배포하는 것을 권장합니다.

### 1. GitHub에 푸시

```bash
git add .
git commit -m "Prepare for deployment"
git push origin main
```

### 2. Vercel 연결

1. [vercel.com](https://vercel.com) 에서 **Add New Project**
2. GitHub 저장소 `inbody-mvp` 선택
3. Framework Preset: **Next.js** (자동 감지)

### 3. 환경 변수 설정 (Vercel Dashboard)

| 변수 | 설명 |
|------|------|
| `DATABASE_URL` | PostgreSQL 연결 URL ([Neon](https://neon.tech) 무료 사용 권장) |
| `SESSION_SECRET` | 32자 이상 랜덤 문자열 |

Neon 사용 시:
1. [neon.tech](https://neon.tech) 에서 프로젝트 생성
2. Connection string 복사 → Vercel `DATABASE_URL`에 붙여넣기
3. 배포 시 `prisma migrate deploy`가 자동 실행됩니다

### 4. 배포

Vercel이 `main` 브랜치 push마다 자동 배포합니다.

## 환경 변수

| 변수 | 필수 | 설명 |
|------|------|------|
| `DATABASE_URL` | ✅ | PostgreSQL 연결 문자열 |
| `SESSION_SECRET` | ✅ | JWT 세션 암호화 키 |

## 주의사항

- 본 서비스는 **의료 진단·치료를 대체하지 않습니다.**
- Vercel 서버리스 환경에서는 결과지 이미지 파일이 저장되지 않습니다 (OCR은 브라우저에서 동작).
- 추천 로직은 규칙 기반 MVP이며, 실제 서비스 전 전문가 검수가 필요합니다.

## 스크립트

| 명령 | 설명 |
|------|------|
| `npm run dev` | 개발 서버 |
| `npm run build` | 프로덕션 빌드 + DB 마이그레이션 |
| `npm run db:migrate` | 로컬 DB 마이그레이션 |
| `npm run lint` | ESLint 검사 |
