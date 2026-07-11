"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
    } else if (user.role === "admin") {
      router.push("/admin");
    } else if (user.role === "agent") {
      router.push("/agent");
    } else {
      router.push("/customer");
    }
  }, [user, loading, router]);

  return null;
}