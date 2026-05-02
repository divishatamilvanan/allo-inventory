// src/app/checkout/[id]/page.tsx
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CheckoutClient from "./CheckoutClient";

export const dynamic = "force-dynamic";

async function getReservation(id: string) {
  const reservation = await prisma.reservation.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, name: true, price: true, imageUrl: true, description: true } },
      warehouse: { select: { id: true, name: true, location: true } },
    },
  });
  return reservation;
}

export default async function CheckoutPage({ params }: { params: { id: string } }) {
  const reservation = await getReservation(params.id);
  if (!reservation) notFound();

  return (
    <CheckoutClient
      reservation={{
        id: reservation.id,
        productId: reservation.productId,
        warehouseId: reservation.warehouseId,
        quantity: reservation.quantity,
        status: reservation.status,
        expiresAt: reservation.expiresAt.toISOString(),
        createdAt: reservation.createdAt.toISOString(),
        product: reservation.product,
        warehouse: reservation.warehouse,
      }}
    />
  );
}
