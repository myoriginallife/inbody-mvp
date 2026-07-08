"use client";

import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return <button onClick={handleLogout} className="text-sm text-zinc-500 hover:text-zinc-800">로그아웃</button>;
}
