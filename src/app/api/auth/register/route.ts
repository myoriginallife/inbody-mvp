import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validations";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "입력값이 올바르지 않습니다" }, { status: 400 });
    const { email, password } = parsed.data;
    if (await prisma.user.findUnique({ where: { email } })) return NextResponse.json({ error: "이미 가입된 이메일입니다" }, { status: 409 });
    const user = await prisma.user.create({ data: { email, password: await bcrypt.hash(password, 10), consentedAt: new Date() } });
    await createSession({ userId: user.id, email: user.email });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "회원가입 중 오류가 발생했습니다" }, { status: 500 });
  }
}
