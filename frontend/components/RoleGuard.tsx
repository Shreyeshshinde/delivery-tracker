"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { UserRole } from "@/lib/types";

export default function RoleGuard({
  allowed,
  children,
}: {
  allowed: UserRole[];
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    if (!allowed.includes(user.role)) {
      router.push("/login");
    }
  }, [user, loading, allowed, router]);

  if (loading || !user || !allowed.includes(user.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen text-slate-400">
        Loading...
      </div>
    );
  }

  return <>{children}</>;
}