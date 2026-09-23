import { requireSession } from "@/lib/auth";
import { chatTurn } from "@/lib/chat";
import { readBody, ok, fail } from "@/lib/apiHelpers";
import { chatBodySchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession();
    rateLimit({ scope: "chat", key: user.id, ...Rate.chat });

    const body = chatBodySchema.parse(await readBody(req));
    const result = await chatTurn({
      userId: user.id,
      sessionId: body.sessionId,
      userText: body.message,
      confirmActionId: body.confirmActionId,
      cancelActionId: body.cancelActionId,
    });
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}
