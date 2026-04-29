import { supabase } from "@/lib/supabase";

type SerializedPushSubscription = {
  endpoint?: string;
  keys?: {
    auth?: string;
    p256dh?: string;
  };
};

function urlBase64ToArrayBuffer(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray.buffer;
}

export function isPushSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js", {
    scope: "/",
    updateViaCache: "none",
  });
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  const registration = await registerServiceWorker();

  return registration.pushManager.getSubscription();
}

export async function currentUserHasPushSubscription(): Promise<boolean> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`Failed to load current session: ${sessionError.message}`);
  }

  if (!session?.user) {
    return false;
  }

  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("user_id", session.user.id)
    .limit(1);

  if (error) {
    throw new Error(`Failed to load push subscription: ${error.message}`);
  }

  return (data?.length ?? 0) > 0;
}

export async function subscribeToFollowUpPush(): Promise<void> {
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Failed to load current user: ${userError.message}`);
  }

  if (!user) {
    throw new Error("Cannot enable reminders without a logged-in user.");
  }

  await registerServiceWorker();
  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (subscription) {
    const existingSubscription = subscription.toJSON() as SerializedPushSubscription;

    if (existingSubscription.endpoint) {
      const { data, error } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("endpoint", existingSubscription.endpoint)
        .limit(1);

      if (error) {
        throw new Error(`Failed to load push subscription: ${error.message}`);
      }

      if ((data?.length ?? 0) > 0) {
        return;
      }
    }

    await subscription.unsubscribe();
    subscription = null;
  }

  subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(vapidPublicKey),
  });

  const serialized = subscription.toJSON() as SerializedPushSubscription;
  if (!serialized.endpoint || !serialized.keys?.p256dh || !serialized.keys.auth) {
    throw new Error("Browser returned an incomplete push subscription.");
  }

  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: serialized.endpoint,
    p256dh: serialized.keys.p256dh,
    auth: serialized.keys.auth,
    user_agent: navigator.userAgent,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw new Error(`Failed to save push subscription: ${error.message}`);
  }
}
