// src/app/api/reservations/[id]/confirm/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params;

  try {
    // Idempotency check
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: `confirm:${idempotencyKey}` },
      });
      if (existing) {
        return NextResponse.json(existing.response, { status: existing.statusCode });
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const reservation = await tx.reservation.findUnique({ where: { id } });

      if (!reservation) {
        return { ok: false, status: 404, body: { error: "Reservation not found" } };
      }
      if (reservation.status !== "PENDING") {
        return {
          ok: false,
          status: 409,
          body: { error: `Reservation is already ${reservation.status.toLowerCase()}` },
        };
      }
      // Check expiry
      if (new Date() > reservation.expiresAt) {
        // Auto-release the hold
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
          where: { id },
          data: { status: "RELEASED" },
        });
        return { ok: false, status: 410, body: { error: "Reservation has expired" } };
      }

      // Confirm: decrement both total and reserved (units are now permanently sold)
      await tx.stock.update({
        where: {
          productId_warehouseId: {
            productId: reservation.productId,
            warehouseId: reservation.warehouseId,
          },
        },
        data: {
          total: { decrement: reservation.quantity },
          reserved: { decrement: reservation.quantity },
        },
      });

      const updated = await tx.reservation.update({
        where: { id },
        data: { status: "CONFIRMED" },
        include: {
          product: { select: { id: true, name: true, price: true, imageUrl: true } },
          warehouse: { select: { id: true, name: true, location: true } },
        },
      });

      return { ok: true, status: 200, body: updated };
    });

    if (idempotencyKey && result.ok) {
      await prisma.idempotencyKey.create({
        data: {
          key: `confirm:${idempotencyKey}`,
          endpoint: `/api/reservations/${id}/confirm`,
          response: result.body,
          statusCode: result.status,
        },
      });
    }

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error("POST /api/reservations/:id/confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
