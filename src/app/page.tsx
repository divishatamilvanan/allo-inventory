// src/app/page.tsx
import { prisma } from "@/lib/prisma";
import ProductCard from "./components/ProductCard";

// Server component: fetch all products with fresh stock data
export const dynamic = "force-dynamic"; // no caching — always fresh stock

async function getProducts() {
  const products = await prisma.product.findMany({
    include: {
      stocks: { include: { warehouse: true } },
    },
    orderBy: { name: "asc" },
  });

  return products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.imageUrl,
    price: p.price,
    stocks: p.stocks.map((s) => ({
      warehouseId: s.warehouseId,
      warehouseName: s.warehouse.name,
      warehouseLocation: s.warehouse.location,
      total: s.total,
      reserved: s.reserved,
      available: Math.max(0, s.total - s.reserved),
    })),
  }));
}

export default async function HomePage() {
  const products = await getProducts();

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1
          style={{
            fontSize: "2rem",
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: "0.5rem",
          }}
        >
          Products
        </h1>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem" }}>
          {products.length} products across all warehouses · Stock updates in real-time
        </p>
      </div>

      {/* Product Grid */}
      {products.length === 0 ? (
        <div
          style={{
            border: "1px dashed var(--border)",
            borderRadius: "12px",
            padding: "4rem 2rem",
            textAlign: "center",
            color: "var(--muted)",
          }}
        >
          <p style={{ fontSize: "1.1rem" }}>No products found.</p>
          <p style={{ fontSize: "0.85rem", marginTop: "0.5rem" }}>
            Run <code style={{ background: "var(--surface-2)", padding: "2px 6px", borderRadius: "4px" }}>npm run db:seed</code> to add sample data.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
            gap: "1.5rem",
          }}
        >
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
