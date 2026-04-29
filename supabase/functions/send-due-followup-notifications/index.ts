import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

type DueContact = {
  id: string;
  user_id: string;
  name: string;
  next_follow_up: string;
};

type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type NotificationStateRow = {
  user_id: string;
  last_notification_date: string | null;
};

const headers = {
  "content-type": "application/json",
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`Missing ${name}`);
  }

  return value;
}

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildMessage(contacts: DueContact[]): string {
  const firstContact = contacts[0];
  const firstName = firstContact.name.trim().split(/\s+/)[0] || firstContact.name;

  if (contacts.length === 1) {
    return `Follow up with ${firstName} today`;
  }

  return `Follow up with ${firstName} and ${contacts.length - 1} others today`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const supabaseUrl = getRequiredEnv("SUPABASE_URL");
    const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const vapidPublicKey = getRequiredEnv("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = getRequiredEnv("VAPID_PRIVATE_KEY");
    const vapidSubject = getRequiredEnv("VAPID_SUBJECT");

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });

    const today = toDateKey(new Date());
    const endOfToday = `${today} 23:59:59.999`;

    const { data: dueContacts, error: contactsError } = await supabase
      .from("contacts")
      .select("id,user_id,name,next_follow_up")
      .not("user_id", "is", null)
      .lte("next_follow_up", endOfToday)
      .order("next_follow_up", { ascending: true });

    if (contactsError) {
      throw contactsError;
    }

    const contacts = (dueContacts ?? []) as DueContact[];
    if (contacts.length === 0) {
      return jsonResponse({ sent: 0, skipped: 0, reason: "No due contacts" });
    }

    const contactsByUser = new Map<string, DueContact[]>();
    for (const contact of contacts) {
      const userContacts = contactsByUser.get(contact.user_id) ?? [];
      userContacts.push(contact);
      contactsByUser.set(contact.user_id, userContacts);
    }

    const userIds = Array.from(contactsByUser.keys());

    const { data: states, error: statesError } = await supabase
      .from("user_notification_state")
      .select("user_id,last_notification_date")
      .in("user_id", userIds);

    if (statesError) {
      throw statesError;
    }

    const stateByUser = new Map(
      ((states ?? []) as NotificationStateRow[]).map((state) => [state.user_id, state.last_notification_date]),
    );

    const usersToNotify = userIds.filter((userId) => stateByUser.get(userId) !== today);

    if (usersToNotify.length === 0) {
      return jsonResponse({ sent: 0, skipped: userIds.length, reason: "Already notified today" });
    }

    const { data: subscriptions, error: subscriptionsError } = await supabase
      .from("push_subscriptions")
      .select("id,user_id,endpoint,p256dh,auth")
      .in("user_id", usersToNotify);

    if (subscriptionsError) {
      throw subscriptionsError;
    }

    const subscriptionsByUser = new Map<string, PushSubscriptionRow[]>();
    for (const subscription of (subscriptions ?? []) as PushSubscriptionRow[]) {
      const userSubscriptions = subscriptionsByUser.get(subscription.user_id) ?? [];
      userSubscriptions.push(subscription);
      subscriptionsByUser.set(subscription.user_id, userSubscriptions);
    }

    let sent = 0;
    let skipped = userIds.length - usersToNotify.length;
    let removedSubscriptions = 0;

    for (const userId of usersToNotify) {
      const userSubscriptions = subscriptionsByUser.get(userId) ?? [];
      if (userSubscriptions.length === 0) {
        skipped += 1;
        continue;
      }

      const message = buildMessage(contactsByUser.get(userId) ?? []);
      const payload = JSON.stringify({
        title: "CRM Follow-Up",
        body: message,
        url: "/contacts",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });

      let userSendCount = 0;

      for (const subscription of userSubscriptions) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: {
                auth: subscription.auth,
                p256dh: subscription.p256dh,
              },
            },
            payload,
          );
          userSendCount += 1;
        } catch (error) {
          const statusCode = typeof error === "object" && error ? (error as { statusCode?: number }).statusCode : null;

          if (statusCode === 404 || statusCode === 410) {
            await supabase.from("push_subscriptions").delete().eq("id", subscription.id);
            removedSubscriptions += 1;
          } else {
            console.error("Failed to send push notification", { userId, subscriptionId: subscription.id, error });
          }
        }
      }

      if (userSendCount > 0) {
        const { error: updateStateError } = await supabase.from("user_notification_state").upsert(
          {
            user_id: userId,
            last_notification_date: today,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );

        if (updateStateError) {
          throw updateStateError;
        }

        sent += 1;
      } else {
        skipped += 1;
      }
    }

    return jsonResponse({
      sent,
      skipped,
      removedSubscriptions,
      checkedUsers: userIds.length,
      dueContacts: contacts.length,
      notificationDate: today,
    });
  } catch (error) {
    console.error(error);
    return jsonResponse({ error: error instanceof Error ? error.message : "Failed to send notifications" }, 500);
  }
});
