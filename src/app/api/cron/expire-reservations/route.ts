// src/app/api/cron/expire-reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
// Called by Vercel Cron every minute (configured in vercel.json)
// Also protectable with CRON_SECRET env var
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find all expired PENDING reservations
    const expired = await prisma.reservation.findMany({
      where: {
        status: "PENDING",
        expiresAt: { lt: new Date() },
      },
    });

    if (expired.length === 0) {
      return NextResponse.json({ released: 0 });
    }

    // Release each one atomically
    let released = 0;
    for (const reservation of expired) {
      await prisma.$transaction(async (tx) => {
        // Double-check still PENDING (avoid race with manual release)
        const current = await tx.reservation.findUnique({
          where: { id: reservation.id },
        });
        if (!current || current.status !== "PENDING") return;

        await tx.stock.update({
          where: {
            productId_warehouseId: {
              productId: reservation.productId,
              warehouseId: reservation.warehouseId,
            },
          },
          data: { reserved: { decrement: reservation.quantity } },
        });

        await tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "RELEASED" },
        });
        released++;
      });
    }

    console.log(`Cron: Released ${released} expired reservations`);
    return NextResponse.json({ released });
  } catch (error) {
    console.error("Cron error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
