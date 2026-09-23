/**
 * AgriLink demo seed.
 * Seeds realistic demo data so the complete SIH flow works end-to-end
 * even when external APIs are mocked: farmers, FPO, buyers, transporters,
 * markets, tomato/onion/chilli prices (26 Aug – 1 Sep 2026, matching the
 * reference UI), arrivals, lots, offers, orders, logistics, payments,
 * disputes, notifications and audit logs.
 *
 * Run: npm run db:setup   (or: docker compose up -d && npx prisma db push && npm run db:seed)
 *
 * The seed is idempotent: it wipes the demo tables and re-creates them.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { makeDemoReportPdf } from "../src/lib/demoPdf";
import { isDemoMode, isProd } from "../src/lib/env";
import { saveBuffer } from "../src/lib/storage";
import { cropGuide, cropStages } from "../src/lib/cropGuide";

const prisma = new PrismaClient();

/**
 * Password for the seeded accounts.
 *
 * This repository must never carry a working credential. Role entry
 * (/api/auth/enter) is passwordless, so the seeded password is only meaningful
 * when an operator explicitly provides DEMO_SEED_PASSWORD. Without it every
 * account gets an unguessable random hash and there is no shared password to
 * leak, publish or reuse.
 */
const PASSWORD = process.env.DEMO_SEED_PASSWORD?.trim() || randomBytes(32).toString("hex");
const DAYS = 7;
// Fixed anchor so the UI chart matches the reference screenshots (26 Aug – 1 Sep).
const FIRST_DAY = new Date("2026-08-26T00:00:00.000Z");

function day(i: number): Date {
  return new Date(FIRST_DAY.getTime() + i * 86400000);
}

async function main() {
  // ── 0. Demo guard ──────────────────────────────────────────────────────
  // This seed wipes the database and creates accounts with a known password.
  // It must NEVER run against a real (production) deployment by accident.
  // Production requires an explicit DEMO_MODE=true and still only for
  // intentional demo databases.
  if (isProd() && !isDemoMode()) {
    console.error(
      "\n🚫  Refusing to seed demo data." +
        "\n    This seeder wipes the database and creates demo accounts with a shared password." +
        "\n    It only runs when demo mode is explicitly enabled (DEMO_MODE=true) or NODE_ENV is not production." +
        "\n    Nothing was modified.\n"
    );
    process.exit(1);
  }
  console.log("🌱  Seeding AgriLink demo data…");

  if ((await prisma.user.count()) > 0) {
    console.log("🌱  Demo data already exists; skipping reset.");
    // Additive steps only — they insert what is missing and never touch rows
    // that already exist, so they are safe on a deployment holding real data.
    await ensureCatalog();
    await ensurePlanner();
    console.log("✅  Additive seed complete (crop catalog + crop planner).");
    return;
  }

  // ── 1. Wipe existing demo data (FK-safe order) ─────────────────────────
  await prisma.notification.deleteMany();
  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.logistics.deleteMany();
  await prisma.dispute.deleteMany();
  await prisma.order.deleteMany();
  await prisma.offer.deleteMany();
  await prisma.qualityReport.deleteMany();
  await prisma.buyerDemand.deleteMany();
  await prisma.expertConsultation.deleteMany();
  await prisma.cropHealthCase.deleteMany();
  await prisma.aIReportAnalysis.deleteMany();
  await prisma.cropHealthImage.deleteMany();
  await prisma.labReport.deleteMany();
  await prisma.labTestRequest.deleteMany();
  await prisma.lab.deleteMany();
  await prisma.plannerActivity.deleteMany();
  await prisma.cropPlanZone.deleteMany();
  await prisma.cropPlan.deleteMany();
  await prisma.lot.deleteMany();
  await prisma.marketPrice.deleteMany();
  await prisma.marketArrival.deleteMany();
  await prisma.market.deleteMany();
  await prisma.crop.deleteMany();
  await prisma.fpoMember.deleteMany();
  await prisma.fpo.deleteMany();
  await prisma.farmerProfile.deleteMany();
  await prisma.buyerProfile.deleteMany();
  await prisma.transporter.deleteMany();
  await prisma.user.deleteMany();

  const pw = bcrypt.hashSync(PASSWORD, 10);

  // ── 2. Crops ───────────────────────────────────────────────────────────
  const tomato = await prisma.crop.create({
    data: { name: "Tomato", category: "Vegetables", unit: "kg", icon: "🍅" },
  });
  const onion = await prisma.crop.create({
    data: { name: "Onion", category: "Vegetables", unit: "kg", icon: "🧅" },
  });
  const chilli = await prisma.crop.create({
    data: { name: "Chilli", category: "Spices", unit: "kg", icon: "🌶️" },
  });

  // ── 3. Markets + price/arrival series ──────────────────────────────────
  // tomatoDaily: per market, per day i in [0..6]: {min, avg, max, arrival}
  const marketSeries: {
    name: string;
    city: string;
    dist: number;
    tomatoDaily: { min: number; avg: number; max: number; arrival: number }[];
  }[] = [
    {
      name: "APMC Bengaluru",
      city: "Bengaluru",
      dist: 32,
      tomatoDaily: [
        { min: 19, avg: 21, max: 24, arrival: 12000 },
        { min: 20, avg: 22, max: 25, arrival: 11500 },
        { min: 20, avg: 21, max: 23, arrival: 11800 },
        { min: 21, avg: 24, max: 27, arrival: 11000 },
        { min: 22, avg: 25, max: 28, arrival: 10600 },
        { min: 23, avg: 26, max: 30, arrival: 10200 },
        { min: 23, avg: 27, max: 31, arrival: 9800 },
      ],
    },
    {
      name: "APMC Ramanagara",
      city: "Ramanagara",
      dist: 18,
      tomatoDaily: [
        { min: 19, avg: 22, max: 25, arrival: 8000 },
        { min: 21, avg: 24, max: 27, arrival: 8200 },
        { min: 22, avg: 25, max: 28, arrival: 7900 },
        { min: 23, avg: 26, max: 29, arrival: 7500 },
        { min: 24, avg: 27, max: 31, arrival: 7200 },
        { min: 25, avg: 28, max: 32, arrival: 7000 },
        { min: 26, avg: 30, max: 34, arrival: 6800 },
      ],
    },
    {
      name: "APMC Mysuru",
      city: "Mysuru",
      dist: 82,
      tomatoDaily: [
        { min: 17, avg: 20, max: 23, arrival: 9000 },
        { min: 19, avg: 22, max: 24, arrival: 8800 },
        { min: 18, avg: 21, max: 24, arrival: 9100 },
        { min: 20, avg: 23, max: 26, arrival: 8600 },
        { min: 22, avg: 25, max: 28, arrival: 8400 },
        { min: 23, avg: 26, max: 29, arrival: 8300 },
        { min: 22, avg: 26, max: 29, arrival: 8100 },
      ],
    },
    {
      name: "APMC Hosur",
      city: "Hosur",
      dist: 45,
      tomatoDaily: [
        { min: 16, avg: 19, max: 22, arrival: 6500 },
        { min: 17, avg: 20, max: 23, arrival: 6400 },
        { min: 18, avg: 21, max: 24, arrival: 6600 },
        { min: 18, avg: 22, max: 25, arrival: 6300 },
        { min: 19, avg: 23, max: 26, arrival: 6100 },
        { min: 20, avg: 24, max: 27, arrival: 6000 },
        { min: 21, avg: 25, max: 28, arrival: 5800 },
      ],
    },
  ];

  const markets: Record<string, string> = {};
  for (const m of marketSeries) {
    const created = await prisma.market.create({
      data: {
        name: m.name,
        city: m.city,
        district: m.city,
        distanceKm: m.dist,
        source: "APMC (e-mandi feed)",
      },
    });
    markets[m.name] = created.id;

    for (let i = 0; i < DAYS; i++) {
      const d = m.tomatoDaily[i];
      await prisma.marketPrice.create({
        data: {
          marketId: created.id,
          cropId: tomato.id,
          date: day(i),
          minPrice: d.min,
          maxPrice: d.max,
          avgPrice: d.avg,
          source: "APMC (e-mandi feed)",
          fetchedAt: new Date(day(i).getTime() + 21 * 3600000), // ~evening feed
        },
      });
      await prisma.marketArrival.create({
        data: {
          marketId: created.id,
          cropId: tomato.id,
          date: day(i),
          quantityKg: d.arrival,
        },
      });
    }

    // Onion + chilli (3 recent days, 2 markets)
    for (const [crop, base, up] of [
      [onion, 18, 21],
      [chilli, 42, 48],
    ] as const) {
      for (let j = 4; j < DAYS; j++) {
        const today = base + ((j - 4) * (up - base)) / 3;
        await prisma.marketPrice.create({
          data: {
            marketId: created.id,
            cropId: crop.id,
            date: day(j),
            minPrice: today - 3,
            maxPrice: today + 2,
            avgPrice: today,
            source: "APMC (e-mandi feed)",
          },
        });
        await prisma.marketArrival.create({
          data: {
            marketId: created.id,
            cropId: crop.id,
            date: day(j),
            quantityKg: 4000 + j * 300,
          },
        });
      }
    }
  }

  const bengaluruId = markets["APMC Bengaluru"];
  const ramanagaraId = markets["APMC Ramanagara"];
  const mysuruId = markets["APMC Mysuru"];

  // ── 4. Users & profiles ────────────────────────────────────────────────
  const ravi = await prisma.user.create({
    data: {
      name: "Ravi Kumar",
      email: "farmer@agrilink.in",
      password: pw,
      phone: "+91 98450 11223",
      role: Role.FARMER,
      verified: true,
      avatarColor: "#2a6b2f",
      farmerProfile: {
        create: {
          village: "Kallahalli",
          district: "Ramanagara",
          farmSizeAcres: 4.5,
          primaryCrops: ["Tomato", "Onion"],
          language: "kn",
        },
      },
    },
  });

  const shantamma = await prisma.user.create({
    data: {
      name: "Shantamma",
      email: "farmer2@agrilink.in",
      password: pw,
      phone: "+91 99000 22110",
      role: Role.FARMER,
      verified: true,
      farmerProfile: {
        create: {
          village: "Channapatna",
          district: "Ramanagara",
          farmSizeAcres: 3,
          primaryCrops: ["Chilli"],
        },
      },
    },
  });

  const gowda = await prisma.user.create({
    data: {
      name: "Hanumanth Gowda",
      email: "farmer3@agrilink.in",
      password: pw,
      role: Role.FARMER,
      verified: false, // in the admin verification queue
      farmerProfile: {
        create: {
          village: "Kanakapura",
          district: "Ramanagara",
          farmSizeAcres: 6,
          primaryCrops: ["Tomato"],
        },
      },
    },
  });

  const fpoAdmin = await prisma.user.create({
    data: {
      name: "Suresh (FPO)",
      email: "fpo@agrilink.in",
      password: pw,
      phone: "+91 97400 33445",
      role: Role.FPO,
      verified: true,
    },
  });

  const fpo = await prisma.fpo.create({
    data: {
      name: "Ramanagara Fresh FPO",
      adminId: fpoAdmin.id,
      district: "Ramanagara",
      verified: true,
      members: {
        create: [
          { userId: ravi.id },
          { userId: shantamma.id },
          { userId: gowda.id },
        ],
      },
    },
  });

  const abc = await prisma.user.create({
    data: {
      name: "ABC Foods Pvt Ltd",
      email: "buyer@agrilink.in",
      password: pw,
      phone: "+91 98860 55667",
      role: Role.BUYER,
      verified: true,
      buyerProfile: {
        create: {
          companyName: "ABC Foods Pvt Ltd",
          gstin: "29AAACB1234F1Z5",
          district: "Bengaluru",
          needs: "Tomato, Onion — Grade A, weekly",
          reliability: 91,
          paymentScore: 94,
          fulfilmentRate: 96,
          avgPaymentDays: 2,
          fssaiLicense: "10012012000001",
          documentsVerified: true,
        },
      },
    },
  });

  const greenMart = await prisma.user.create({
    data: {
      name: "GreenMart Retail",
      email: "buyer2@agrilink.in",
      password: pw,
      role: Role.BUYER,
      verified: true,
      buyerProfile: {
        create: {
          companyName: "GreenMart Retail",
          district: "Bengaluru",
          needs: "Vegetables for retail chain",
          reliability: 87,
          paymentScore: 88,
          fulfilmentRate: 90,
          avgPaymentDays: 3,
          documentsVerified: true,
        },
      },
    },
  });

  const freshExport = await prisma.user.create({
    data: {
      name: "FreshExport India",
      email: "buyer3@agrilink.in",
      password: pw,
      role: Role.BUYER,
      verified: true,
      buyerProfile: {
        create: {
          companyName: "FreshExport India",
          district: "Bengaluru",
          reliability: 82,
          paymentScore: 90,
          fulfilmentRate: 84,
          avgPaymentDays: 5,
          documentsVerified: true,
        },
      },
    },
  });

  const veeresh = await prisma.user.create({
    data: {
      name: "Veeresh Kumar",
      email: "transporter@agrilink.in",
      password: pw,
      phone: "+91 96320 88776",
      role: Role.TRANSPORTER,
      verified: true,
      transporter: {
        create: {
          vehicleType: "Mini truck (1.5T)",
          vehicleNumber: "KA-51-A-2345",
          capacityKg: 1500,
          serviceArea: "Ramanagara → Bengaluru",
        },
      },
    },
  });

  const admin = await prisma.user.create({
    data: {
      name: "AgriLink Admin",
      email: "admin@agrilink.in",
      password: pw,
      role: Role.ADMIN,
      verified: true,
    },
  });

  // ── 5. Lots ────────────────────────────────────────────────────────────
  // Ravi's active lot — the hero of the demo (matches reference UI)
  const lot12452 = await prisma.lot.create({
    data: {
      lotNo: "AG12452",
      farmerId: ravi.id,
      fpoId: fpo.id,
      cropId: tomato.id,
      variety: "Rashmi (Hybrid)",
      quantityKg: 1200,
      grade: "A",
      qualityScore: 89,
      harvestDate: new Date("2026-08-31T00:00:00.000Z"),
      availableDate: new Date("2026-09-01T00:00:00.000Z"),
      location: "Ramanagara",
      expectedPrice: 32,
      minPrice: 28,
      packaging: "Plastic crates (20 kg)",
      storage: "Shade, max 2 days",
      notes: "Fresh harvest, good colour, low moisture",
      photos: ["https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=400"],
      status: "LISTED",
      qualityReports: {
        create: {
          grade: "A",
          size: "Medium (5–7 cm)",
          moisture: "4.2%",
          defects: "Low (<3%)",
          freshness: "Harvested 31 Aug",
          inspector: "Farmer self-declaration",
        },
      },
    },
  });

  // Ravi's older, already-sold lots
  const oldLot1 = await prisma.lot.create({
    data: {
      lotNo: "AG12110",
      farmerId: ravi.id,
      cropId: tomato.id,
      quantityKg: 300,
      grade: "A",
      qualityScore: 86,
      harvestDate: new Date("2026-08-20T00:00:00.000Z"),
      availableDate: new Date("2026-08-21T00:00:00.000Z"),
      location: "Ramanagara",
      expectedPrice: 29,
      minPrice: 25,
      status: "SOLD",
    },
  });
  const oldLot2 = await prisma.lot.create({
    data: {
      lotNo: "AG12144",
      farmerId: ravi.id,
      cropId: tomato.id,
      quantityKg: 150,
      grade: "B",
      qualityScore: 78,
      harvestDate: new Date("2026-08-22T00:00:00.000Z"),
      availableDate: new Date("2026-08-23T00:00:00.000Z"),
      location: "Ramanagara",
      expectedPrice: 28,
      minPrice: 24,
      status: "SOLD",
    },
  });
  const oldLot3 = await prisma.lot.create({
    data: {
      lotNo: "AG12190",
      farmerId: ravi.id,
      cropId: tomato.id,
      quantityKg: 500,
      grade: "A",
      qualityScore: 88,
      harvestDate: new Date("2026-08-18T00:00:00.000Z"),
      availableDate: new Date("2026-08-19T00:00:00.000Z"),
      location: "Ramanagara",
      expectedPrice: 27,
      minPrice: 24,
      status: "SOLD",
    },
  });

  // Chilli lot from Shantamma (drives the buyer / offer flow)
  const chilliLot = await prisma.lot.create({
    data: {
      lotNo: "AG12488",
      farmerId: shantamma.id,
      cropId: chilli.id,
      variety: "Byadagi",
      quantityKg: 900,
      grade: "A",
      qualityScore: 92,
      harvestDate: new Date("2026-08-30T00:00:00.000Z"),
      availableDate: new Date("2026-09-01T00:00:00.000Z"),
      location: "Channapatna",
      expectedPrice: 50,
      minPrice: 44,
      status: "OFFER_RECEIVED",
      qualityReports: {
        create: {
          grade: "A",
          moisture: "8.1%",
          defects: "Low",
          inspector: "FPO quality check",
        },
      },
    },
  });

  // FPO bulk onion lot
  const bulkLot = await prisma.lot.create({
    data: {
      lotNo: "AG12501",
      farmerId: fpoAdmin.id,
      fpoId: fpo.id,
      cropId: onion.id,
      quantityKg: 8400,
      grade: "A",
      qualityScore: 84,
      harvestDate: new Date("2026-08-28T00:00:00.000Z"),
      availableDate: new Date("2026-09-02T00:00:00.000Z"),
      location: "Ramanagara (FPO aggregation)",
      expectedPrice: 21,
      minPrice: 18,
      status: "LISTED",
    },
  });

  // ── 6. Buyer demands ───────────────────────────────────────────────────
  await prisma.buyerDemand.create({
    data: {
      buyerId: abc.id,
      cropId: tomato.id,
      quantityKg: 2000,
      grade: "A",
      maxPrice: 33,
      location: "Bengaluru",
      requiredBy: new Date("2026-09-05T00:00:00.000Z"),
    },
  });
  await prisma.buyerDemand.create({
    data: {
      buyerId: greenMart.id,
      cropId: tomato.id,
      quantityKg: 1500,
      grade: "A",
      maxPrice: 31,
      location: "Bengaluru",
    },
  });
  await prisma.buyerDemand.create({
    data: {
      buyerId: freshExport.id,
      cropId: chilli.id,
      quantityKg: 5000,
      grade: "A",
      maxPrice: 46,
      location: "Bengaluru",
      requiredBy: new Date("2026-09-10T00:00:00.000Z"),
    },
  });

  // ── 7. Offers ──────────────────────────────────────────────────────────
  const now = new Date();
  const offer1 = await prisma.offer.create({
    data: {
      offerNo: "OFF-9012",
      lotId: lot12452.id,
      buyerId: abc.id,
      quantityKg: 1200,
      pricePerKg: 32,
      status: "SUBMITTED",
      message: "Can take full 1,200 kg at ₹32/kg. Pickup by 2 Sep, payment in 2 days.",
      expiresAt: new Date(now.getTime() + 48 * 3600000),
      history: [
        { status: "SUBMITTED", at: new Date("2026-09-01T10:30:00.000Z"), by: "ABC Foods Pvt Ltd" },
      ],
    },
  });
  const offer2 = await prisma.offer.create({
    data: {
      offerNo: "OFF-9013",
      lotId: lot12452.id,
      buyerId: greenMart.id,
      quantityKg: 800,
      pricePerKg: 30,
      status: "COUNTERED",
      message: "Initial offer ₹30/kg. Open to counter.",
      expiresAt: new Date(now.getTime() + 48 * 3600000),
      history: [
        { status: "SUBMITTED", at: new Date("2026-09-01T11:00:00.000Z"), by: "GreenMart Retail" },
        { status: "COUNTERED", at: new Date("2026-09-01T12:15:00.000Z"), by: "GreenMart Retail", note: "Countered to ₹31/kg" },
      ],
    },
  });
  const chilliOffer = await prisma.offer.create({
    data: {
      offerNo: "OFF-9020",
      lotId: chilliLot.id,
      buyerId: freshExport.id,
      quantityKg: 900,
      pricePerKg: 47,
      status: "SUBMITTED",
      message: "Export grade requirement met. ₹47/kg, pickup at Channapatna.",
      expiresAt: new Date(now.getTime() + 72 * 3600000),
      history: [{ status: "SUBMITTED", at: new Date("2026-09-01T09:00:00.000Z"), by: "FreshExport India" }],
    },
  });

  // ── 8. Orders + logistics + payments ───────────────────────────────────
  const order1 = await prisma.order.create({
    data: {
      orderNo: "AG-1001",
      lotId: oldLot1.id,
      sellerId: ravi.id,
      buyerId: abc.id,
      cropName: "Tomato",
      quantityKg: 300,
      pricePerKg: 28,
      totalAmount: 8400,
      status: "PAYMENT_PENDING",
      pickupAddress: "Kallahalli, Ramanagara",
      deliveryAddress: "Peenya, Bengaluru",
      dueDate: new Date("2026-09-03T00:00:00.000Z"),
      timeline: [
        { status: "ACCEPTED", at: new Date("2026-08-21T09:00:00.000Z"), note: "Offer accepted" },
        { status: "PICKUP_SCHEDULED", at: new Date("2026-08-21T15:00:00.000Z"), note: "Pickup 22 Aug, 7 AM" },
        { status: "IN_TRANSIT", at: new Date("2026-08-22T07:30:00.000Z") },
        { status: "DELIVERED", at: new Date("2026-08-22T11:15:00.000Z"), note: "Proof of delivery uploaded" },
        { status: "PAYMENT_PENDING", at: new Date("2026-08-23T00:00:00.000Z"), note: "Due 3 Sep" },
      ],
      logistics: {
        create: {
          transporterId: veeresh.id,
          vehicleNumber: "KA-51-A-2345",
          driverName: "Veeresh Kumar",
          driverPhone: "+91 96320 88776",
          pickupTime: new Date("2026-08-22T07:00:00.000Z"),
          eta: new Date("2026-08-22T11:00:00.000Z"),
          status: "DELIVERED",
          pickupLocation: "Kallahalli, Ramanagara",
          deliveryLocation: "Peenya, Bengaluru",
          proofOfPickup: ["photo-lot-12110-pickup.jpg"],
          proofOfDelivery: ["photo-lot-12110-delivery.jpg"],
        },
      },
      payments: {
        create: {
          kind: "FINAL",
          amount: 8400,
          status: "PENDING",
          payerId: abc.id,
          payeeId: ravi.id,
          dueDate: new Date("2026-09-03T00:00:00.000Z"),
        },
      },
    },
  });

  const order2 = await prisma.order.create({
    data: {
      orderNo: "AG-1002",
      lotId: oldLot2.id,
      sellerId: ravi.id,
      buyerId: greenMart.id,
      cropName: "Tomato",
      quantityKg: 150,
      pricePerKg: 27,
      totalAmount: 4050,
      status: "PAYMENT_PENDING",
      dueDate: new Date("2026-09-04T00:00:00.000Z"),
      timeline: [
        { status: "ACCEPTED", at: new Date("2026-08-23T10:00:00.000Z") },
        { status: "DELIVERED", at: new Date("2026-08-24T12:00:00.000Z") },
        { status: "PAYMENT_PENDING", at: new Date("2026-08-25T00:00:00.000Z"), note: "Due 4 Sep" },
      ],
      logistics: {
        create: { status: "DELIVERED" },
      },
      payments: {
        create: {
          kind: "FINAL",
          amount: 4050,
          status: "PENDING",
          payerId: greenMart.id,
          payeeId: ravi.id,
          dueDate: new Date("2026-09-04T00:00:00.000Z"),
        },
      },
    },
  });

  await prisma.order.create({
    data: {
      orderNo: "AG-1003",
      lotId: oldLot3.id,
      sellerId: ravi.id,
      buyerId: abc.id,
      cropName: "Tomato",
      quantityKg: 500,
      pricePerKg: 26,
      totalAmount: 13000,
      advanceAmount: 13000,
      paidAmount: 13000,
      status: "CLOSED",
      timeline: [
        { status: "ACCEPTED", at: new Date("2026-08-19T09:00:00.000Z") },
        { status: "DELIVERED", at: new Date("2026-08-20T10:00:00.000Z") },
        { status: "PAID", at: new Date("2026-08-22T16:00:00.000Z"), note: "UPI ref UPI-88121" },
        { status: "CLOSED", at: new Date("2026-08-22T16:05:00.000Z") },
      ],
      payments: {
        create: {
          kind: "FINAL",
          amount: 13000,
          status: "PAID",
          payerId: abc.id,
          payeeId: ravi.id,
          paidAt: new Date("2026-08-22T16:00:00.000Z"),
          reference: "UPI-88121",
        },
      },
    },
  });

  // Live demo flow: accepted chilli offer → fresh order needing a transporter
  const order4 = await prisma.order.create({
    data: {
      orderNo: "AG-1004",
      lotId: chilliLot.id,
      offerId: chilliOffer.id,
      sellerId: shantamma.id,
      buyerId: freshExport.id,
      cropName: "Chilli",
      quantityKg: 900,
      pricePerKg: 47,
      totalAmount: 42300,
      advanceAmount: 5000,
      paidAmount: 5000,
      status: "PICKUP_SCHEDULED",
      pickupAddress: "Channapatna",
      deliveryAddress: "Kengeri FCI yard, Bengaluru",
      dueDate: new Date("2026-09-06T00:00:00.000Z"),
      timeline: [
        { status: "ACCEPTED", at: new Date("2026-09-01T09:30:00.000Z"), note: "Offer OFF-9020 accepted" },
        { status: "PICKUP_SCHEDULED", at: new Date("2026-09-01T14:00:00.000Z"), note: "Transporter requested" },
      ],
      logistics: {
        create: {
          status: "PENDING",
          pickupLocation: "Channapatna",
          deliveryLocation: "Kengeri, Bengaluru",
          pickupTime: new Date("2026-09-02T07:00:00.000Z"),
        },
      },
      payments: {
        create: [
          {
            kind: "ADVANCE",
            amount: 5000,
            status: "PAID",
            payerId: freshExport.id,
            payeeId: shantamma.id,
            paidAt: new Date("2026-09-01T15:00:00.000Z"),
            reference: "UPI-99452",
          },
          {
            kind: "FINAL",
            amount: 37300,
            status: "PENDING",
            payerId: freshExport.id,
            payeeId: shantamma.id,
            dueDate: new Date("2026-09-06T00:00:00.000Z"),
          },
        ],
      },
    },
  });

  // Mark the chilli offer ACCEPTED + link it
  await prisma.offer.update({
    where: { id: chilliOffer.id },
    data: { status: "ACCEPTED" },
  });

  // ── 9. Dispute (open, for the admin demo) ─────────────────────────────
  await prisma.dispute.create({
    data: {
      disputeNo: "DSP-5001",
      raisedById: ravi.id,
      orderId: order1.id,
      type: "PAYMENT_ISSUE",
      description:
        "Order AG-1001 (₹8,400) was delivered on 22 Aug. Payment due 3 Sep is still pending from ABC Foods.",
      status: "OPEN",
      evidence: [],
    },
  });
  await prisma.dispute.create({
    data: {
      disputeNo: "DSP-5002",
      raisedById: abc.id,
      orderId: order2.id,
      type: "QUALITY_DISPUTE",
      description:
        "Grade B tomatoes in AG-1002 had ~8% over-ripe fruit at delivery; requesting ₹150 adjustment.",
      status: "UNDER_REVIEW",
      evidence: ["photo-dispute-1002.jpg"],
    },
  });

  // ── 10. Lab Testing & AI Crop Health (DEMO DATA) ─────────────────────
  // Demo labs, requests, reports, AI analysis, crop-health cases and expert
  // consultations so the full lab flow works offline. All demo lab results
  // are synthetic — clearly marked DEMO DATA in the UI, never real results.
  const labAgri = await prisma.lab.create({
    data: {
      name: "AgriLab Testing Center",
      description: "NABL-accredited plant disease & nutrient analysis for smallholder farmers.",
      location: "Ramanagara",
      address: "No. 42, Bidadi Main Road, Ramanagara 562159",
      distanceKm: 18,
      services: ["Plant Disease Testing", "Pest/Disease Identification", "Nutrient Testing", "Soil Testing"],
      supportedCrops: ["Tomato", "Onion", "Chilli", "Potato", "Brinjal"],
      testTypes: ["Plant Disease Test", "Nutrient Analysis", "Soil Test", "Pest Identification"],
      phone: "+91 98765 41001",
      email: "hello@agrilab.in",
      website: "agrilab.in",
      operatingHours: "Mon–Sat, 9:00 AM – 6:00 PM",
      accreditation: "NABL (demo)",
      isVerified: true,
      rating: 4.5,
      approxPrice: 350,
      turnaroundDays: 3,
    },
  });
  await prisma.lab.create({
    data: {
      name: "Krishi Soil & Water Lab",
      description: "Soil health cards and irrigation water quality analysis.",
      location: "Bengaluru",
      distanceKm: 55,
      services: ["Soil Testing", "Water Testing", "Nutrient Testing"],
      supportedCrops: ["Tomato", "Onion", "Chilli", "All crops"],
      testTypes: ["Soil Test", "Water Quality", "Nutrient Analysis"],
      phone: "+91 98450 22011",
      email: "lab@krishisw.in",
      operatingHours: "Mon–Sat, 8:30 AM – 5:30 PM",
      accreditation: "State Agriculture Dept empanelled (demo)",
      isVerified: true,
      rating: 4.2,
      approxPrice: 250,
      turnaroundDays: 5,
    },
  });
  await prisma.lab.create({
    data: {
      name: "Plant Patho Diagnostic Lab",
      description: "Fungal/bacterial/viral disease diagnosis with microscopy.",
      location: "Mysuru",
      distanceKm: 82,
      services: ["Plant Disease Testing", "Pest/Disease Identification"],
      supportedCrops: ["Tomato", "Chilli", "Brinjal", "Grapes"],
      testTypes: ["Plant Disease Test", "Pest Identification"],
      phone: "+91 99010 33522",
      email: "care@plantpatho.in",
      operatingHours: "Mon–Fri, 9:00 AM – 5:00 PM",
      accreditation: "ICAR-linked (demo)",
      isVerified: false,
      rating: 3.9,
      approxPrice: 500,
      turnaroundDays: 4,
    },
  });
  await prisma.lab.create({
    data: {
      name: "Residue & Quality Analysis Hub",
      description: "Pesticide residue, crop quality and export-grade testing.",
      location: "Bengaluru",
      distanceKm: 48,
      services: ["Residue Testing", "Crop Quality Testing", "Nutrient Testing"],
      supportedCrops: ["Tomato", "Onion", "Chilli", "Exports"],
      testTypes: ["Residue Analysis", "Crop Quality Test", "Nutrient Analysis"],
      phone: "+91 98860 77891",
      email: "test@residuehub.in",
      operatingHours: "Mon–Sat, 9:00 AM – 6:30 PM",
      accreditation: "FSSAI NABL (demo)",
      isVerified: true,
      rating: 4.6,
      approxPrice: 900,
      turnaroundDays: 6,
    },
  });

  // Active request — tomato leaf spots & yellowing, sample at the lab
  const labReq1 = await prisma.labTestRequest.create({
    data: {
      requestNo: "LT-1001",
      farmerId: ravi.id,
      crop: "Tomato",
      variety: "Arka Vikas",
      lotId: lot12452.id,
      location: "Ramanagara",
      problemCategory: "DISEASE",
      problemDescription:
        "Lower leaves turning yellow with small dark spots spreading to middle canopy over the last week.",
      symptoms: "Yellowing from lower leaves upward; circular brown spots with yellow halo on leaflets.",
      dateNoticed: new Date("2026-08-26T00:00:00.000Z"),
      affectedAreaPct: 35,
      severity: "Medium",
      preferredLabId: labAgri.id,
      preferredDate: new Date("2026-09-03T00:00:00.000Z"),
      additionalNotes: "Sprayed neem oil twice; no improvement yet.",
      status: "SAMPLE_SUBMITTED",
    },
  });
  await prisma.labTestRequest.create({
    data: {
      requestNo: "LT-1002",
      farmerId: ravi.id,
      crop: "Onion",
      variety: "Bellary Red",
      location: "Ramanagara",
      problemCategory: "SOIL",
      problemDescription: "Stunted bulb growth on a 0.4 acre block; routine soil health check.",
      symptoms: "Uniform stunting; leaves slightly pale green.",
      dateNoticed: new Date("2026-07-20T00:00:00.000Z"),
      affectedAreaPct: 60,
      severity: "Low",
      preferredLabId: labAgri.id,
      status: "COMPLETED",
    },
  });

  // Completed report + AI analysis + crop-health case (the demo story)
  // Write a real, readable demo PDF (values + reference ranges) so the
  // AI analysis of LR-1001 is grounded in actual extracted text.
  const demoPdf = makeDemoReportPdf();
  saveBuffer("lab-reports", "demo-report-plant-disease.pdf", demoPdf);

  const labReport = await prisma.labReport.create({
    data: {
      reportNo: "LR-1001",
      farmerId: ravi.id,
      testRequestId: labReq1.id,
      labId: labAgri.id,
      lotId: lot12452.id,
      crop: "Tomato",
      testType: "Plant Disease Test",
      reportDate: new Date("2026-09-02T00:00:00.000Z"),
      fileName: "demo-report-plant-disease.pdf",
      storedName: "demo-report-plant-disease.pdf",
      mimeType: "application/pdf",
      fileSize: demoPdf.length,
      status: "ANALYZED",
      notes: "DEMO DATA — synthetic report for the SIH demo flow. Not a real lab result.",
    },
  });
  const labAnalysis = await prisma.aIReportAnalysis.create({
    data: {
      reportId: labReport.id,
      summary:
        "The demo plant-disease report shows early leaf-spot symptoms consistent with a fungal infection (Septoria/early blight type), with secondary nutrient stress from yellowing lower leaves. Findings are based on the sample description — confirm with the lab before any treatment.",
      abnormalFindings: [
        "Small circular spots with yellow halos on leaflets (suggested fungal leaf spot).",
        "Chlorosis (yellowing) of lower leaves — possible nitrogen deficiency or restricted root uptake.",
        "~35% of canopy affected at time of sampling.",
      ],
      possibleCauses: [
        "Fungal leaf spot (e.g. Septoria/early blight) favoured by humidity and leaf wetness.",
        "Nutrient imbalance — yellowing lower leaves often reflects nitrogen stress.",
        "Secondary pest pressure on stressed plants (to be confirmed by scouting).",
      ],
      cropImpact:
        "Untreated, leaf-spot can defoliate the lower canopy, reduce fruit size and delay maturity — moderate yield impact if it spreads before the harvest window.",
      recommendedActions: [
        "Remove and dispose of heavily affected lower leaves away from the field.",
        "Improve air movement — avoid overhead irrigation in the evening; water at the base.",
        "Get the lab's confirmation of the pathogen and follow their advisory.",
        "If a fungicide is confirmed appropriate, apply the active ingredient as per label and legally approved use — never exceed the label dose.",
        "Scout twice a week; record spread before deciding to treat.",
      ],
      prevention:
        "Rotate crops away from Solanaceae for a season, use certified seed, keep the field free of crop debris, and avoid dense planting to reduce humidity.",
      treatmentCategories: [
        "Cultural: sanitation, debris removal, spacing.",
        "Biological: beneficial microbes / bio-fungicides (if locally registered).",
        "Chemical: only after confirmed diagnosis — protective fungicide category per label, verified with an agronomist.",
      ],
      confidence: "Medium",
      confidenceReason:
        "Based on the farmer's symptom description and the demo report summary; no measured pathogen data in the demo file.",
      expertReviewRecommended: true,
      expertNote:
        "DEMO ANALYSIS — not a diagnosis. Verify with the testing lab or a Krishi Vigyan Kendra agronomist before applying any chemical.",
      model: "agrilink-offline-analysis-v1",
    },
  });
  const case1 = await prisma.cropHealthCase.create({
    data: {
      caseNo: "CH-1001",
      farmerId: ravi.id,
      requestId: labReq1.id,
      reportId: labReport.id,
      aiAnalysisId: labAnalysis.id,
      crop: "Tomato",
      problem: "Leaf spots and yellowing — suspected fungal leaf spot",
      labName: labAgri.name,
      testType: "Plant Disease Test",
      actionTaken: "Awaiting lab confirmation; sanitation started.",
      status: "IN_PROGRESS",
    },
  });
  await prisma.expertConsultation.create({
    data: {
      caseId: case1.id,
      farmerId: ravi.id,
      question:
        "My tomato lower leaves have yellow spots spreading upward. The demo analysis suggests fungal leaf spot — should I treat now or wait for the lab report?",
      context:
        "Crop: Tomato · Symptoms: yellowing lower leaves, circular spots with yellow halo · Demo report analyzed (Medium confidence).",
      status: "ANSWERED",
      response:
        "Wait for the lab's confirmed pathogen before spraying. Meanwhile do sanitation — remove affected lower leaves, avoid evening overhead watering, and keep records. If the spots spread past 50% of the canopy, consult the KVK agronomist with photos.",
      respondedAt: new Date("2026-09-02T17:00:00.000Z"),
    },
  });

  // ── 10. Notifications ──────────────────────────────────────────────────
  const noteData: { userId: string; type: string; title: string; body: string; link: string; read: boolean }[] = [
    { userId: ravi.id, type: "OFFER", title: "New offer received", body: "ABC Foods offered ₹32/kg for your 1,200 kg Tomato lot AG12452.", link: "/lots/AG12452", read: false },
    { userId: ravi.id, type: "AI", title: "AI sell recommendation", body: "Tomato prices expected ₹31–33/kg. Consider waiting 2–3 days.", link: "/dashboard", read: false },
    { userId: ravi.id, type: "PAYMENT", title: "Payment due in 2 days", body: "ABC Foods owes ₹8,400 (AG-1001), due 3 Sep.", link: "/payments", read: false },
    { userId: ravi.id, type: "MATCH", title: "New buyer match", body: "GreenMart Retail matches your onion lot AG12501 at 96%.", link: "/lots/AG12501", read: true },
    { userId: abc.id, type: "MATCH", title: "New lot matched", body: "1,200 kg Grade A Tomato near you — Ravi Kumar, Ramanagara.", link: "/lots/AG12452", read: false },
    { userId: shantamma.id, type: "OFFER", title: "Offer accepted", body: "FreshExport accepted your offer — order AG-1004 created.", link: "/orders", read: false },
    { userId: fpoAdmin.id, type: "INFO", title: "Bulk lot listed", body: "8,400 kg Onion (Grade A) is now live for buyers.", link: "/lots/AG12501", read: false },
    { userId: ravi.id, type: "LAB", title: "Lab request submitted", body: "Lab test LT-1001 (Tomato — leaf spots & yellowing) sent to AgriLab Testing Center.", link: "/lab-testing", read: false },
    { userId: ravi.id, type: "LAB", title: "Sample submitted", body: "AgriLab received your tomato sample (LT-1001). Expected report in ~3 days.", link: "/lab-testing", read: false },
    { userId: ravi.id, type: "LAB", title: "Lab report uploaded", body: "Plant Disease Test report LR-1001 added to your crop health history.", link: "/lab-testing", read: false },
    { userId: ravi.id, type: "AI", title: "AI analysis ready", body: "AI analyzed LR-1001 — possible fungal leaf spot + nutrient stress (Medium confidence). Verify with the lab.", link: "/lab-testing", read: false },
  ];
  for (const n of noteData) {
    await prisma.notification.create({ data: n });
  }

  // ── 11. Audit logs ─────────────────────────────────────────────────────
  await prisma.auditLog.createMany({
    data: [
      { userId: ravi.id, action: "LOT_CREATED", entityType: "Lot", entityId: lot12452.id, details: { lotNo: "AG12452" } },
      { userId: ravi.id, action: "OFFER_RECEIVED", entityType: "Offer", entityId: offer1.id, details: { offerNo: "OFF-9012", pricePerKg: 32 } },
      { userId: ravi.id, action: "DISPUTE_RAISED", entityType: "Dispute", entityId: order1.id, details: { disputeNo: "DSP-5001" } },
      { userId: abc.id, action: "ORDER_CREATED", entityType: "Order", entityId: order4.id, details: { orderNo: "AG-1004" } },
      { userId: admin.id, action: "USER_VERIFIED", entityType: "User", details: { user: "Ravi Kumar" } },
    ],
  });

  // ── 12. One seeded chat session for Ravi ───────────────────────────────
  const session = await prisma.chatSession.create({
    data: {
      userId: ravi.id,
      title: "Selling 1,200 kg Tomato",
      messages: {
        create: [
          { role: "user", content: "What is the tomato price near me today?" },
          {
            role: "assistant",
            content:
              "Near Ramanagara today:\n• APMC Ramanagara — ₹30/kg avg (₹26–34)\n• APMC Bengaluru — ₹27/kg avg (₹23–31)\n• APMC Mysuru — ₹26/kg avg\nPrices are rising ~7% over the last week while arrivals are falling. Data source: APMC (e-mandi feed), 1 Sep, evening update.",
          },
        ],
      },
    },
  });

  // ── 13. Crop Planner catalog + plan (additive, re-runnable) ────────────
  await ensureCatalog();
  await ensurePlanner();

  console.log("✅  Seed complete.");
  console.log("    Role entry is passwordless — open /login and pick a profile:");
  console.log("      Farmer · FPO · Buyer · Transporter · Admin");
  console.log("    (No credential is stored in this repository by design.)");
  console.log("    Chat session seeded: '" + session.title + "'");
}

// ─── Additive seeders ──────────────────────────────────────────────────────
// These run on EVERY seed — including against a database that already holds
// real data. They only insert what is missing, which is what lets a new deploy
// teach an existing deployment about the Crop Planner without wiping anything.

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Crops the planner can select, with a 7-day mandi series for each. */
const CATALOG: { name: string; category: string; icon: string; base: number }[] = [
  { name: "Carrot", category: "Vegetables", icon: "🥕", base: 30 },
  { name: "Beans", category: "Vegetables", icon: "🫘", base: 42 },
  { name: "Brinjal", category: "Vegetables", icon: "🍆", base: 24 },
  { name: "Banana", category: "Fruits", icon: "🍌", base: 26 },
  { name: "Papaya", category: "Fruits", icon: "🧡", base: 28 },
  { name: "Sugarcane", category: "Cash Crops", icon: "🎋", base: 3.6 },
  { name: "Groundnut", category: "Cash Crops", icon: "🥜", base: 58 },
  { name: "Ragi", category: "Cereals", icon: "🌾", base: 34 },
];

/** Crop rows the planner needs. A new crop only gets one price series. */
export async function ensureCatalog() {
  const markets = await prisma.market.findMany({ orderBy: { name: "asc" } });
  if (markets.length === 0) return;

  // Anchor the new series to the same closing date as the existing feed so the
  // whole catalogue reports one "as of" date.
  const latest = (await prisma.marketPrice.findFirst({ orderBy: { date: "desc" }, select: { date: true } }))?.date;
  const lastDate = latest ? new Date(latest) : new Date();
  const firstDate = new Date(lastDate.getTime() - 6 * 86400000);
  const marketDrift = [0.05, 0.02, -0.02, -0.05];

  for (const entry of CATALOG) {
    const crop =
      (await prisma.crop.findFirst({ where: { name: entry.name } })) ??
      (await prisma.crop.create({ data: { name: entry.name, category: entry.category, unit: "kg", icon: entry.icon } }));

    if ((await prisma.marketPrice.count({ where: { cropId: crop.id } })) > 0) continue;

    for (const [mi, market] of markets.entries()) {
      for (let i = 0; i < 7; i++) {
        const date = new Date(firstDate.getTime() + i * 86400000);
        const avg = round2(entry.base * (1 + marketDrift[mi % marketDrift.length] + (i - 3) * 0.009));
        await prisma.marketPrice.create({
          data: {
            marketId: market.id,
            cropId: crop.id,
            date,
            minPrice: round2(avg * 0.9),
            avgPrice: avg,
            maxPrice: round2(avg * 1.14),
            unit: "kg",
          },
        });
        await prisma.marketArrival.create({
          data: { marketId: market.id, cropId: crop.id, date, quantityKg: Math.round(4000 + mi * 1200 + i * 180) },
        });
      }
    }
    console.log(`   catalog: ${entry.name} (${entry.category}) price series added`);
  }
}

/**
 * One active crop plan with plots, for the first seeded farmer. Created only
 * when that farmer has no plan yet, so field logs written by the user survive
 * every later deploy.
 */
export async function ensurePlanner() {
  const farmer = await prisma.user.findFirst({ where: { role: Role.FARMER }, orderBy: { createdAt: "asc" } });
  if (!farmer) return;
  if (await prisma.cropPlan.findFirst({ where: { farmerId: farmer.id, isActive: true } })) return;

  const crop = (await prisma.crop.findFirst({ where: { name: "Tomato" } })) ?? (await prisma.crop.findFirst());
  if (!crop) return;

  const guide = cropGuide(crop.name);
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
  // Start the demo mid-cycle (day ~50 of a 100-day tomato) so the pipeline
  // shows the foliar/irrigation stage as live rather than "day 1" or "harvest".
  const sowingDate = addDays(today, -Math.round(guide.cycleDays * 0.5));
  const variety = guide.varieties[0] ?? null;
  const lot = await prisma.lot.findFirst({ where: { farmerId: farmer.id }, orderBy: { createdAt: "asc" } });

  const zones = [
    { zoneName: "Zone Alpha", cropName: crop.name, variety, acreage: 0.8, healthScore: 94 },
    { zoneName: "Zone Beta", cropName: "Onion", variety: "Bellary Red", acreage: 0.4, healthScore: 88 },
    { zoneName: "Zone Gamma", cropName: "Chilli", variety: "Guntur Sannam", acreage: 0.3, healthScore: 81 },
  ];

  const plan = await prisma.cropPlan.create({
    data: {
      farmerId: farmer.id,
      cropId: crop.id,
      lotId: lot?.id ?? null,
      title: `${crop.name} plan${lot ? ` · Lot ${lot.lotNo}` : ""}`,
      cropLabel: variety ? `${crop.name} (${variety})` : crop.name,
      variety,
      season: "Kharif",
      sowingDate,
      harvestWindowStart: addDays(sowingDate, Math.round(guide.cycleDays * 0.66)),
      harvestWindowEnd: addDays(sowingDate, guide.cycleDays + 14),
      farmHoldingAcres: 1.5,
      allocatedAcres: 1.5,
      stages: cropStages(crop.name),
      careProtocols: guide.care,
      pestScan: guide.pests,
      zones: {
        create: zones.map((z) => {
          const zGuide = cropGuide(z.cropName);
          return {
            ...z,
            projectedYieldTons: Math.round(z.acreage * zGuide.yieldTonsPerAcre * (0.85 + 0.15 * (z.healthScore / 100)) * 10) / 10,
            lastAction: "Soil & vigour logged",
            loggedAt: addDays(today, -2),
          };
        }),
      },
      activities: {
        create: [
          { actorId: farmer.id, kind: "PLAN_CREATED", label: `Plan created for ${crop.name}`, detail: `Kharif season · ${zones.length} plots · 1.50 acres allocated` },
          { actorId: farmer.id, kind: "ZONE_LOGGED", label: "Zone Alpha inspected", detail: "Plot health 94% · irrigation on schedule" },
        ],
      },
    },
    include: { zones: true },
  });

  console.log(`   planner: ${plan.title} with ${plan.zones.length} plots seeded`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());