import { prisma } from "@/lib/db";
import { requireSession, logAudit } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { readBody, ok, fail } from "@/lib/apiHelpers";
import { demandCreateSchema } from "@/lib/schemas";
import { assertSameOrigin } from "@/lib/csrf";
import { rateLimit, Rate } from "@/lib/rateLimit";
import { Role } from "@prisma/client";

export async function GET() {
  try {
    const user = await requireSession();
    // Buyers see their own demands; farmers/FPOs see the active demand
    // marketplace; admin sees everything.
    const where =
      user.role === Role.BUYER
        ? { buyerId: user.id }
        : user.role === Role.ADMIN
          ? {}
          : { status: "ACTIVE" };
    const demands = await prisma.buyerDemand.findMany({
      where,
      include: { crop: true, buyer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ demands });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const user = await requireSession([Role.BUYER]);
    if (!user.verified) {
      throw { status: 403, message: "Your buyer account must be verified before posting requirements" };
    }
    rateLimit({ scope: "demand:create", key: user.id, ...Rate.action });

    const body = demandCreateSchema.parse(await readBody(req));
    const crop = await prisma.crop.findUnique({ where: { id: body.cropId } });
    if (!crop) throw { status: 400, message: "Unknown crop" };

    const demand = await prisma.buyerDemand.create({
      data: {
        buyerId: user.id,
        cropId: body.cropId,
        quantityKg: body.quantityKg,
        grade: body.grade ?? "A",
        maxPrice: body.maxPrice ?? null,
        location: body.location ?? "Bengaluru",
        requiredBy: body.requiredBy ? new Date(body.requiredBy) : null,
        status: "ACTIVE",
      },
    });

    const farmers = await prisma.lot.findMany({
      where: { cropId: body.cropId, status: "LISTED" },
      select: { farmerId: true },
      distinct: ["farmerId"],
    });
    for (const f of farmers) {
      await notify({
        userId: f.farmerId,
        type: "MATCH",
        title: "New buyer demand",
        body: `${user.name} needs ${body.quantityKg.toLocaleString("en-IN")} kg ${crop.name}${body.maxPrice ? ` up to ₹${body.maxPrice}/kg` : ""}.`,
        link: "/buyers",
      });
    }
    await logAudit(user.id, "DEMAND_POSTED", "BuyerDemand", demand.id, {});
    return ok({ demand }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}
