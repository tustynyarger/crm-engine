"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { currentUserHasPushSubscription, isPushSupported, subscribeToFollowUpPush } from "@/lib/push";
import { supabase } from "@/lib/supabase";

type PushStatus = "checking" | "unsupported" | "idle" | "enabled" | "saving" | "error";

export function PushNotificationToggle() {
  const pathname = usePathname();
  const [status, setStatus] = useState<PushStatus>("checking");
  const isMountedRef = useRef(false);

  async function loadSubscriptionState() {
    if (!isPushSupported()) {
      if (isMountedRef.current) {
        setStatus("unsupported");
      }
      return;
    }

    try {
      const hasSubscription = await currentUserHasPushSubscription();
      if (isMountedRef.current) {
        setStatus(hasSubscription ? "enabled" : "idle");
      }
    } catch {
      if (isMountedRef.current) {
        setStatus("idle");
      }
    }
  }

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setStatus("checking");
      void loadSubscriptionState();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [pathname]);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      setStatus("checking");
      void loadSubscriptionState();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname]);

  async function handleEnable() {
    setStatus("saving");

    try {
      await subscribeToFollowUpPush();
      setStatus("enabled");
    } catch {
      setStatus("error");
    }
  }

  if (status === "checking" || status === "unsupported") {
    return null;
  }

  return (
    <div className="border-t border-slate-200 pt-3">
      <button
        className="inline-flex w-full cursor-pointer items-center justify-between rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-75"
        disabled={status === "saving" || status === "enabled"}
        onClick={() => void handleEnable()}
        type="button"
      >
        <span>{status === "enabled" ? "Reminders on" : status === "saving" ? "Enabling..." : "Enable reminders"}</span>
        <span
          className={
            status === "enabled"
              ? "h-2 w-2 rounded-full bg-emerald-500"
              : "h-2 w-2 rounded-full bg-slate-300"
          }
        />
      </button>
    </div>
  );
}
