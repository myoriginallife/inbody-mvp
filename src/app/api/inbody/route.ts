import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateRecommendations } from "@/lib/recommendations";
import { inbodySchema, type ProfileInput } from "@/lib/validations";

function toProfileInput(profile: { gender: string; age: number; height: number; goal: string; activityLevel: string }): ProfileInput {
  return {
    gender: profile.gender as ProfileInput["gender"],
    age: profile.age,
    height: profile.height,
    goal: profile.goal as ProfileInput["goal"],
    activityLevel: profile.activityLevel as ProfileInput["activityLevel"],
  };
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: session.userId } });
    if (!profile) return NextResponse.json({ error: "먼저 기본 정보를 입력해주세요" }, { status: 400 });
    const formData = await request.formData();
    const parsed = inbodySchema.safeParse({
      weight: formData.get("weight"),
      skeletalMuscle: formData.get("skeletalMuscle"),
      bodyFatMass: formData.get("bodyFatMass") || undefined,
      bodyFatPercent: formData.get("bodyFatPercent"),
      bmi: formData.get("bmi"),
      visceralFat: formData.get("visceralFat") || undefined,
      basalMetabolicRate: formData.get("basalMetabolicRate") || undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다" }, { status: 400 });
    let imagePath: string | undefined;
    const imageFile = formData.get("image");
    if (imageFile instanceof File && imageFile.size > 0 && process.env.VERCEL !== "1") {
      try {
        const uploadsDir = path.join(process.cwd(), "public", "uploads", session.userId);
        await mkdir(uploadsDir, { recursive: true });
        const filename = `${Date.now()}${path.extname(imageFile.name) || ".jpg"}`;
        await writeFile(path.join(uploadsDir, filename), Buffer.from(await imageFile.arrayBuffer()));
        imagePath = `/uploads/${session.userId}/${filename}`;
      } catch {
        // 서버리스 환경에서는 파일 저장을 건너뜁니다 (OCR은 클라이언트에서 처리됨)
      }
    }
    const recommendations = generateRecommendations(toProfileInput(profile), parsed.data);
    const record = await prisma.inbodyRecord.create({
      data: {
        userId: session.userId, ...parsed.data, imagePath,
        summary: recommendations.summary,
        dietPlan: JSON.stringify(recommendations.dietPlan),
        exercisePlan: JSON.stringify(recommendations.exercisePlan),
        rationales: JSON.stringify(recommendations.rationales),
      },
    });
    return NextResponse.json({ success: true, id: record.id });
  } catch {
    return NextResponse.json({ error: "인바디 결과 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
