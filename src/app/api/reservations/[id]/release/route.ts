// src/app/api/reservations/[id]/release/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });

      if (!reservation) {
        return { status: 404, body: { error: "Reservation not found" } };
      }
      if (reservation.status !== "PENDING") {
        return {
          status: 409,
          body: { error: `Cannot release a ${reservation.status.toLowerCase()} reservation` },
        };
      }

      // Return units back to available pool
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: { reserved: { decrement: reservation.quantity } },
      });

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "RELEASED" },
        include: {
          product: { select: { id: true, name: true, price: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
      });

      return { status: 200, body: updated };
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST /api/reservations/:id/release error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
