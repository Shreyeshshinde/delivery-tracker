"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const homeLink =
    user.role === "admin" ? "/admin" : user.role === "agent" ? "/agent" : "/customer";

  return (
    <nav className="bg-ink text-paper px-6 py-4 flex items-center justify-between border-b-2 border-signal">
      <Link href={homeLink} className="flex items-baseline gap-2">
        <span className="font-display font-extrabold text-lg tracking-tight">
          WAYBILL
        </span>
        <span className="font-[family-name:var(--font-plex-mono)] text-[10px] text-slate uppercase tracking-widest">
          delivery ops
        </span>
      </Link>
      <div className="flex items-center gap-5 text-sm">
        <span className="text-slate">
          {user.name}
        </span>
        <span className="font-[family-name:var(--font-plex-mono)] text-[10px] uppercase tracking-widest bg-signal text-ink px-2 py-1 rounded-sm font-medium">
          {user.role}
        </span>
        <button
          onClick={logout}
          className="text-slate hover:text-paper transition-colors text-xs uppercase tracking-wide"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}