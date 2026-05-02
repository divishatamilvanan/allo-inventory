// src/app/api/reservations/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { redis } from "@/lib/redis";
import { CreateReservationSchema } from "@/lib/schemas";

const RESERVATION_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    const parseResult = CreateReservationSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.errors[0].message },
        { status: 400 }
      );
    }

    const { productId, warehouseId, quantity } = parseResult.data;

    // --- Idempotency ---
    const idempotencyKey = req.headers.get("idempotency-key");
    if (idempotencyKey) {
      const existing = await prisma.idempotencyKey.findUnique({
        where: { key: `reserve:${idempotencyKey}` },
      });
      if (existing) {
        return NextResponse.json(existing.response, { status: existing.statusCode });
      }
    }

    // --- Distributed Lock via Redis ---
    // Lock key is scoped to the specific product+warehouse combination.
    // This prevents two concurrent requests from both reading "available > 0"
    // before either has had a chance to update the DB.
    const lockKey = `lock:stock:${productId}:${warehouseId}`;
    const lockToken = `${Date.now()}-${Math.random()}`;
    const lockTTL = 5000; // 5 seconds

    // SET NX PX is atomic in Redis — only one caller gets the lock
    const acquired = await redis.set(lockKey, lockToken, "PX", lockTTL, "NX");
    if (!acquired) {
      return NextResponse.json(
        { error: "Stock is being updated. Please retry in a moment." },
        { status: 503 }
      );
    }

    try {
      // --- Atomic reservation inside the lock ---
      const result = await prisma.$transaction(async (tx) => {
        // Re-read inside transaction under the distributed lock
        const stock = await tx.stock.findUnique({
          where: { productId_warehouseId: { productId, warehouseId } },
        });

        if (!stock) {
          return { ok: false, status: 404, body: { error: "Stock not found for this product/warehouse" } };
        }

        const available = stock.total - stock.reserved;
        if (available < quantity) {
          return {
            ok: false,
            status: 409,
            body: {
              error: `Not enough stock. Requested ${quantity}, available ${available}.`,
              available,
            },
          };
        }

        // Atomically increment reserved count
        await tx.stock.update({
          where: { productId_warehouseId: { productId, warehouseId } },
          data: { reserved: { increment: quantity } },
        });

        const expiresAt = new Date(Date.now() + RESERVATION_WINDOW_MS);
        const reservation = await tx.reservation.create({
          data: { productId, warehouseId, quantity, status: "PENDING", expiresAt },
          include: {
            product: { select: { id: true, name: true, price: true, imageUrl: true } },
            warehouse: { select: { id: true, name: true, location: true } },
          },
        });

        return { ok: true, status: 201, body: reservation };
      });

      // Save idempotency result
      if (idempotencyKey && result.ok) {
        await prisma.idempotencyKey.create({
          data: {
            key: `reserve:${idempotencyKey}`,
            endpoint: "/api/reservations",
            response: result.body,
            statusCode: result.status,
          },
        });
      }

      return NextResponse.json(result.body, { status: result.status });
    } finally {
      // Release lock only if we still own it
      const current = await redis.get(lockKey);
      if (current === lockToken) {
        await redis.del(lockKey);
      }
    }
  } catch (error) {
    console.error("POST /api/reservations error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
