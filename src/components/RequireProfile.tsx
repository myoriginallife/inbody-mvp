"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getProfile } from "@/lib/client-storage";

export function RequireProfile({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    if (!getProfile()) {
      router.replace("/onboarding");
    }
  }, [router]);

  if (!getProfile()) return null;

  return <>{children}</>;
}
