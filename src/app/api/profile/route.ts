import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { profileSchema } from "@/lib/validations";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  try {
    const body = await request.json();
    const parsed = profileSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다" }, { status: 400 });
    await prisma.profile.upsert({ where: { userId: session.userId }, create: { userId: session.userId, ...parsed.data }, update: parsed.data });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다" }, { status: 500 });
  }
}
