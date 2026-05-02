"use client";
// src/app/components/ProductCard.tsx
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ProductWithStock } from "@/types";

interface Props {
  product: ProductWithStock;
}

export default function ProductCard({ product }: Props) {
  const router = useRouter();
  const [selectedWarehouse, setSelectedWarehouse] = useState(
    product.stocks.find((s) => s.available > 0)?.warehouseId || product.stocks[0]?.warehouseId
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedStock = product.stocks.find((s) => s.warehouseId === selectedWarehouse);
  const totalAvailable = product.stocks.reduce((sum, s) => sum + s.available, 0);

  const handleReserve = async () => {
    if (!selectedWarehouse || !selectedStock || selectedStock.available < 1) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "idempotency-key": `${product.id}-${selectedWarehouse}-${Date.now()}`,
        },
        body: JSON.stringify({
          productId: product.id,
          warehouseId: selectedWarehouse,
          quantity: 1,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Could not reserve item. Please try again.");
        return;
      }

      router.push(`/checkout/${data.id}`);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const stockColor =
    totalAvailable === 0
      ? "var(--danger)"
      : totalAvailable <= 2
      ? "var(--warning)"
      : "var(--green)";

  return (
    <div
      className="slide-up"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        overflow: "hidden",
        transition: "border-color 0.2s, transform 0.2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.borderColor = "var(--green-dim)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "var(--border)")
      }
    >
      {/* Image */}
      {product.imageUrl && (
        <div
          style={{
            height: "180px",
            overflow: "hidden",
            background: "var(--surface-2)",
          }}
        >
          <img
            src={product.imageUrl}
            alt={product.name}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      <div style={{ padding: "1.25rem" }}>
        {/* Title + Price */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.5rem", marginBottom: "0.5rem" }}>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, color: "var(--text)", margin: 0, lineHeight: 1.3 }}>
            {product.name}
          </h2>
          <span
            style={{
              fontFamily: "'DM Mono', monospace",
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--green)",
              whiteSpace: "nowrap",
            }}
          >
            ₹{product.price.toLocaleString("en-IN")}
          </span>
        </div>

        {product.description && (
          <p style={{ color: "var(--muted)", fontSize: "0.8rem", margin: "0 0 1rem" }}>
            {product.description}
          </p>
        )}

        {/* Stock Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            background: "var(--surface-2)",
            border: `1px solid ${stockColor}33`,
            borderRadius: "6px",
            padding: "3px 10px",
            marginBottom: "1rem",
            fontSize: "0.75rem",
            fontFamily: "'DM Mono', monospace",
          }}
        >
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: stockColor,
              display: "inline-block",
            }}
          />
          <span style={{ color: stockColor }}>
            {totalAvailable === 0
              ? "OUT OF STOCK"
              : `${totalAvailable} unit${totalAvailable !== 1 ? "s" : ""} available`}
          </span>
        </div>

        {/* Warehouse Selector */}
        {product.stocks.length > 0 && (
          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.72rem", color: "var(--muted)", display: "block", marginBottom: "0.4rem", letterSpacing: "0.05em" }}>
              WAREHOUSE
            </label>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
              {product.stocks.map((stock) => (
                <button
                  key={stock.warehouseId}
                  onClick={() => setSelectedWarehouse(stock.warehouseId)}
                  disabled={stock.available === 0}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${selectedWarehouse === stock.warehouseId ? "var(--green)" : "var(--border)"}`,
                    background: selectedWarehouse === stock.warehouseId ? "rgba(34,197,94,0.08)" : "var(--surface-2)",
                    cursor: stock.available === 0 ? "not-allowed" : "pointer",
                    opacity: stock.available === 0 ? 0.5 : 1,
                    transition: "all 0.15s",
                    textAlign: "left",
                    width: "100%",
                  }}
                >
                  <span style={{ fontSize: "0.8rem", color: "var(--text)" }}>
                    {stock.warehouseName}
                  </span>
                  <span
                    style={{
                      fontSize: "0.72rem",
                      fontFamily: "'DM Mono', monospace",
                      color: stock.available === 0 ? "var(--danger)" : "var(--green)",
                    }}
                  >
                    {stock.available === 0 ? "sold out" : `${stock.available} avail`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            style={{
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.3)",
              borderRadius: "8px",
              padding: "8px 12px",
              marginBottom: "0.75rem",
              fontSize: "0.8rem",
              color: "var(--danger)",
            }}
          >
            {error}
          </div>
        )}

        {/* Reserve Button */}
        <button
          onClick={handleReserve}
          disabled={loading || !selectedStock || selectedStock.available === 0}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "8px",
            border: "none",
            background:
              !selectedStock || selectedStock.available === 0
                ? "var(--surface-2)"
                : loading
                ? "var(--green-dim)"
                : "var(--green)",
            color:
              !selectedStock || selectedStock.available === 0
                ? "var(--muted)"
                : "#000",
            fontWeight: 600,
            fontSize: "0.875rem",
            cursor:
              loading || !selectedStock || selectedStock.available === 0
                ? "not-allowed"
                : "pointer",
            transition: "all 0.15s",
          }}
        >
          {loading
            ? "Reserving…"
            : !selectedStock || selectedStock.available === 0
            ? "Out of Stock"
            : "Reserve · 10 min hold"}
        </button>
      </div>
    </div>
  );
}
