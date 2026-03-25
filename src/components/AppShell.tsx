"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const SidebarNav = dynamic(
  () => import("@/components/SidebarNav").then((module) => module.SidebarNav),
  { ssr: false },
);

export function AppShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const isLoginPage = pathname === "/login";

  function openSidebar() {
    setIsOpen(true);
  }

  function closeSidebar() {
    setIsOpen(false);
  }

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      setSession(data.session);
      setAuthChecked(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthChecked(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authChecked) {
      return;
    }

    if (session && isLoginPage) {
      router.replace("/contacts");
      return;
    }

    if (!session && !isLoginPage) {
      const timer = window.setTimeout(() => {
        closeSidebar();
        router.replace("/login");
      }, 0);

      return () => window.clearTimeout(timer);
    }
  }, [authChecked, isLoginPage, router, session]);

  if (!authChecked || (isLoginPage && session) || (!isLoginPage && !session)) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-100/80 p-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
          Loading...
        </div>
      </div>
    );
  }

  if (isLoginPage) {
    return <div className="min-h-screen bg-slate-100/80 p-4 sm:p-5">{children}</div>;
  }

  return (
    <div className="flex h-screen w-full bg-slate-100/80">
      <SidebarNav className="hidden w-56 border-r border-slate-200 bg-slate-50/90 p-4 backdrop-blur-sm lg:block" />

      <main className="flex-1 overflow-auto">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white p-3 lg:hidden">
          <button className="text-xl text-slate-900" onClick={openSidebar} type="button">
            ☰
          </button>
          <span className="font-semibold text-slate-900">CRM</span>
        </div>
        <div className="min-h-full p-4 sm:p-5">{children}</div>
      </main>

      {isOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={closeSidebar} />

          <SidebarNav
            className="absolute left-0 top-0 h-full w-64 bg-white p-4 shadow-lg transition-transform duration-200"
            onNavigate={closeSidebar}
          />
        </div>
      ) : null}
    </div>
  );
}
