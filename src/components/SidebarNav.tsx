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
  const activeClassName = "bg-[#eb0003] !text-white";
  const inactiveClassName = "text-slate-900 hover:bg-white";

  return `${baseClassName} ${isActive ? activeClassName : inactiveClassName}`;
}

export function SidebarNav({ className = "", onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    await supabase.auth.signOut();
    setIsLogoutModalOpen(false);
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
          onClick={() => setIsLogoutModalOpen(true)}
          type="button"
        >
          {isLoggingOut ? "Logging out..." : "Logout"}
        </button>
      </div>

      {isLogoutModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-sm">
          <div className="crm-fade-up w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-semibold text-slate-900">Log out?</h2>
            <p className="mt-2 text-sm text-slate-600">Are you sure you want to log out?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                disabled={isLoggingOut}
                onClick={() => setIsLogoutModalOpen(false)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-[#eb0003] px-3 py-2 text-sm font-medium text-white shadow-sm hover:bg-[#c40003] disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isLoggingOut}
                onClick={() => void handleLogout()}
                type="button"
              >
                {isLoggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
