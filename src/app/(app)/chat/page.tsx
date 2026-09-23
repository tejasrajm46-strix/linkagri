import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { ChatClient } from "@/components/ChatClient";

export const metadata = { title: "AI Copilot" };
export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const user = await requireSession();
  const session = await prisma.chatSession.findFirst({
    where: { userId: user.id },
    include: { messages: { orderBy: { createdAt: "asc" }, take: 40 } },
    orderBy: { updatedAt: "desc" },
  });
  const initial = (session?.messages ?? [])
    .filter((m) => m.role === "user" || (m.role === "assistant" && !(m.metadata as { pendingAction?: { status: string } } | null)?.pendingAction))
    .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }));

  return <ChatClient userName={user.name} role={user.role} initial={initial} />;
}