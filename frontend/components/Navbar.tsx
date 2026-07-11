"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth-context";

export default function Navbar() {
  const { user, logout } = useAuth();

  if (!user) return null;

  const homeLink =
    user.role === "admin" ? "/admin" : user.role === "agent" ? "/agent" : "/customer";

  return (
    <nav className="border-b border-slate-200 bg-white px-6 py-3 flex items-center justify-between">
      <Link href={homeLink} className="font-semibold text-slate-900">
        Delivery Tracker
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <span className="text-slate-500">
          {user.name} <span className="text-slate-400">· {user.role}</span>
        </span>
        <button
          onClick={logout}
          className="text-slate-500 hover:text-slate-900 transition-colors"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}