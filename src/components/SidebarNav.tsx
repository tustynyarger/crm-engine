"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

type SidebarNavProps = {
  className?: string;
  onNavigate?: () => void;
};

function getLinkClassName(isActive: boolean): string {
  const baseClassName = "block cursor-pointer rounded-xl px-3 py-2.5 font-medium transition";
  const activeClassName = "bg-slate-900 !text-white";
  const inactiveClassName = "text-slate-900 hover:bg-white";

  return `${baseClassName} ${isActive ? activeClassName : inactiveClassName}`;
}

export function SidebarNav({ className = "", onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await supabase.auth.signOut();
    onNavigate?.();
    router.replace("/login");
    setIsLoggingOut(false);
  }

  return (
    <aside className={`${className} flex flex-col`}>
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">CRM</h2>

      <div className="space-y-2 text-sm">
        <Link className={getLinkClassName(pathname === "/")} href="/" onClick={onNavigate}>
          Dashboard
        </Link>
        <Link className={getLinkClassName(pathname === "/contacts")} href="/contacts" onClick={onNavigate}>
          Contacts
        </Link>
        <Link className={getLinkClassName(pathname === "/add")} href="/add" onClick={onNavigate}>
          Add
        </Link>
      </div>

      <div className="mt-auto pt-4">
        <button
          className="block w-full cursor-pointer rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition hover:bg-white"
          disabled={isLoggingOut}
          onClick={() => void handleLogout()}
          type="button"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>
    </aside>
  );
}
