// prisma/seed.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await prisma.reservation.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.idempotencyKey.deleteMany();

  // Create warehouses
  const mumbai = await prisma.warehouse.create({
    data: { name: "Mumbai Central", location: "Mumbai, Maharashtra" },
  });
  const delhi = await prisma.warehouse.create({
    data: { name: "Delhi North Hub", location: "Delhi, NCR" },
  });
  const bangalore = await prisma.warehouse.create({
    data: { name: "Bangalore Tech Park", location: "Bangalore, Karnataka" },
  });

  // Create products
  const products = await Promise.all([
    prisma.product.create({
      data: {
        name: "Sony WH-1000XM5 Headphones",
        description: "Industry-leading noise cancelling wireless headphones",
        imageUrl: "https://images.unsplash.com/photo-1618366712010-f4ae9c647dcb?w=400",
        price: 29990,
      },
    }),
    prisma.product.create({
      data: {
        name: "Apple iPad Pro 12.9\"",
        description: "Supercharged by M2 chip with Liquid Retina XDR display",
        imageUrl: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400",
        price: 112900,
      },
    }),
    prisma.product.create({
      data: {
        name: "Nike Air Max 270",
        description: "Lightweight and breathable running shoes with Air unit",
        imageUrl: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400",
        price: 12995,
      },
    }),
    prisma.product.create({
      data: {
        name: "Dyson V15 Detect",
        description: "Powerful cordless vacuum with laser dust detection",
        imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400",
        price: 52900,
      },
    }),
    prisma.product.create({
      data: {
        name: "Kindle Paperwhite",
        description: "Waterproof e-reader with 6.8\" display and adjustable warm light",
        imageUrl: "https://images.unsplash.com/photo-1592496431122-2349e0fbc666?w=400",
        price: 13999,
      },
    }),
  ]);

  // Create stock levels
  const warehouses = [mumbai, delhi, bangalore];
  const stockData = [
    [5, 3, 2],   // Sony headphones
    [2, 1, 0],   // iPad Pro (low stock)
    [10, 8, 6],  // Nike shoes
    [1, 0, 2],   // Dyson vacuum (very low)
    [15, 12, 9], // Kindle
  ];

  for (let p = 0; p < products.length; p++) {
    for (let w = 0; w < warehouses.length; w++) {
      await prisma.stock.create({
        data: {
          productId: products[p].id,
          warehouseId: warehouses[w].id,
          total: stockData[p][w],
          reserved: 0,
        },
      });
    }
  }

  console.log("✅ Seeding complete!");
  console.log(`   ${products.length} products`);
  console.log(`   ${warehouses.length} warehouses`);
  console.log(`   ${products.length * warehouses.length} stock entries`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
