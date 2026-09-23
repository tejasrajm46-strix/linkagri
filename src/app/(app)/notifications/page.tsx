import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader, EmptyState } from "@/components/ui";
import { MarkAllRead, MarkRead } from "@/components/notificationActions";
import { timeAgo } from "@/lib/format";
import { Icon } from "@/components/icons";

export const metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

const TYPE_STYLE: Record<string, string> = {
  OFFER: "bg-blue-50 text-blue-700",
  MATCH: "bg-emerald-50 text-emerald-700",
  ORDER: "bg-indigo-50 text-indigo-700",
  LOGISTICS: "bg-teal-50 text-teal-700",
  PAYMENT: "bg-emerald-50 text-emerald-700",
  DISPUTE: "bg-amber-50 text-amber-700",
  AI: "bg-purple-50 text-purple-700",
  INFO: "bg-gray-100 text-gray-600",
};

export default async function NotificationsPage() {
  const user = await requireSession();
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={`${unread} unread · offers, matches, orders, payments & disputes`}
        actions={unread ? <MarkAllRead /> : null}
      />
      {notifications.length === 0 ? (
        <EmptyState icon="bell" title="All caught up" body="You'll be notified about offers, buyer matches, order updates and payments." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Card key={n.id} className={`card-pad !p-4 ${!n.read ? "!bg-brand-50/40 border-brand-200" : "opacity-75"}`}>
              <div className="flex items-start gap-3">
                <span className={`badge mt-0.5 ${TYPE_STYLE[n.type] ?? TYPE_STYLE.INFO}`}>{n.type}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{n.title}</p>
                    {!n.read ? <span className="h-2 w-2 rounded-full bg-brand-600 shrink-0" /> : null}
                  </div>
                  <p className="text-sm text-ink-muted mt-0.5">{n.body}</p>
                  <p className="text-[11px] text-ink-faint mt-1 flex items-center gap-1">
                    <Icon name="clock" className="w-3 h-3" /> {timeAgo(n.createdAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  {n.link ? (
                    <Link href={n.link} className="text-xs font-semibold text-brand-700 hover:underline">
                      View →
                    </Link>
                  ) : null}
                  {!n.read ? <MarkRead id={n.id} /> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}