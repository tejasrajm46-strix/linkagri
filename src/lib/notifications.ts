import { prisma } from "./db";

export type NotifyInput = {
  userId: string;
  type: "OFFER" | "MATCH" | "ORDER" | "LOGISTICS" | "PAYMENT" | "DISPUTE" | "AI" | "LAB" | "INFO";
  title: string;
  body: string;
  link?: string;
};

/**
 * In-app notification + pluggable external channel. The spec requires an
 * abstraction so SMS/WhatsApp/push providers can be swapped later — that is
 * what notifyExternal() is for. Without provider keys configured it simply
 * logs, so the demo works offline.
 */
export async function notify(input: NotifyInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    },
  });
  const user = await prisma.user.findUnique({ where: { id: input.userId } });
  if (user?.phone) await notifyExternal(user.phone, input);
}

/** Provider abstraction — swap in Twilio / Msg91 / Gupshup / FCM later. */
export async function notifyExternal(
  phone: string,
  input: Omit<NotifyInput, "userId">
): Promise<void> {
  const provider = process.env.SMS_PROVIDER || "none";
  if (provider === "none" || provider === "log") {
    console.log(`[notify:${provider}] → ${phone} | ${input.title}: ${input.body}`);
    return;
  }
  // Example provider adapter (kept intentionally simple):
  // if (provider === "msg91") { await fetch("https://control.msg91.com/api/v5/flow/", {...}) }
  // if (provider === "twilio") { ... }
  throw new Error(`SMS provider "${provider}" is not wired up yet — see src/lib/notifications.ts`);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { read: true },
  });
}

export async function markAllRead(userId: string) {
  await prisma.notification.updateMany({ where: { userId }, data: { read: true } });
}