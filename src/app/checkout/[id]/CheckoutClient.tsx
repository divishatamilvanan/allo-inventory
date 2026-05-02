"use client";
// src/app/checkout/[id]/CheckoutClient.tsx
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ReservationWithDetails } from "@/types";

interface Props {
  reservation: ReservationWithDetails & {
    product: { description?: string | null };
  };
}

function useCountdown(expiresAt: string, status: string) {
  const [timeLeft, setTimeLeft] = useState(() =>
    Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
  );

  useEffect(() => {
    if (status !== "PENDING") return;
    const interval = setInterval(() => {
      const secs = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setTimeLeft(secs);
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, status]);

  const mins = Math.floor(timeLeft / 60);
  const secs = timeLeft % 60;
  const isWarning = timeLeft <= 120 && timeLeft > 30;
  const isDanger = timeLeft <= 30;

  return { timeLeft, mins, secs, isWarning, isDanger };
}

export default function CheckoutClient({ reservation: initial }: Props) {
  const router = useRouter();
  const [reservation, setReservation] = useState(initial);
  const [loading, setLoading] = useState<"confirm" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { timeLeft, mins, secs, isWarning, isDanger } = useCountdown(
    reservation.expiresAt,
    reservation.status
  );

  // Auto-expire UI when countdown hits zero
  useEffect(() => {
    if (timeLeft === 0 && reservation.status === "PENDING") {
      setReservation((prev) => ({ ...prev, status: "RELEASED" }));
    }
  }, [timeLeft, reservation.status]);

  const handleConfirm = useCallback(async () => {
    setLoading("confirm");
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/confirm`, {
        method: "POST",
        headers: {
          "idempotency-key": `confirm-${reservation.id}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 410) {
          setError("Your reservation has expired. The stock has been released.");
          setReservation((prev) => ({ ...prev, status: "RELEASED" }));
        } else {
          setError(data.error || "Could not confirm. Please try again.");
        }
        return;
      }
      setReservation((prev) => ({ ...prev, status: "CONFIRMED" }));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }, [reservation.id]);

  const handleCancel = useCallback(async () => {
    setLoading("cancel");
    setError(null);
    try {
      const res = await fetch(`/api/reservations/${reservation.id}/release`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not cancel. Please try again.");
        return;
      }
      setReservation((prev) => ({ ...prev, status: "RELEASED" }));
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(null);
    }
  }, [reservation.id]);

  const isPending = reservation.status === "PENDING";
  const isConfirmed = reservation.status === "CONFIRMED";
  const isReleased = reservation.status === "RELEASED";

  return (
    <div style={{ maxWidth: "560px", margin: "0 auto" }}>
      {/* Back */}
      <button
        onClick={() => router.push("/")}
        style={{
          background: "none",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: "0.85rem",
          padding: 0,
          marginBottom: "1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
        }}
      >
        ← Back to products
      </button>

      {/* Status Banner */}
      {isConfirmed && (
        <div
          className="slide-up"
          style={{
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.4)",
            borderRadius: "12px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>✅</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--green)" }}>
              Purchase Confirmed!
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
              Your order has been placed successfully.
            </p>
          </div>
        </div>
      )}

      {isReleased && (
        <div
          className="slide-up"
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid rgba(248,113,113,0.3)",
            borderRadius: "12px",
            padding: "1.25rem 1.5rem",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <span style={{ fontSize: "1.5rem" }}>🔓</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, color: "var(--danger)" }}>
              Reservation Released
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "0.8rem", color: "var(--muted)" }}>
              Stock has been returned to the pool.
            </p>
          </div>
        </div>
      )}

      {/* Card */}
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "16px",
          overflow: "hidden",
        }}
      >
        {/* Product image header */}
        {reservation.product.imageUrl && (
          <div
            style={{
              height: "200px",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <img
              src={reservation.product.imageUrl}
              alt={reservation.product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "linear-gradient(to bottom, transparent 50%, var(--surface))",
              }}
            />
          </div>
        )}

        <div style={{ padding: "1.5rem" }}>
          {/* Product info */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h1
              style={{
                fontSize: "1.35rem",
                fontWeight: 700,
                margin: "0 0 0.25rem",
                color: "var(--text)",
              }}
            >
              {reservation.product.name}
            </h1>
            <p
              style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: "1.15rem",
                color: "var(--green)",
                margin: 0,
              }}
            >
              ₹{reservation.product.price.toLocaleString("en-IN")}
            </p>
          </div>

          {/* Details Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "1rem",
              marginBottom: "1.5rem",
            }}
          >
            <DetailBox label="WAREHOUSE" value={reservation.warehouse.name} sub={reservation.warehouse.location} />
            <DetailBox label="QUANTITY" value={`${reservation.quantity} unit${reservation.quantity !== 1 ? "s" : ""}`} />
            <DetailBox
              label="STATUS"
              value={reservation.status}
              valueColor={
                isConfirmed ? "var(--green)" : isReleased ? "var(--danger)" : "var(--warning)"
              }
            />
            <DetailBox
              label="RESERVATION ID"
              value={reservation.id.slice(0, 12) + "…"}
              mono
            />
          </div>

          {/* Countdown */}
          {isPending && (
            <div
              style={{
                background: "var(--surface-2)",
                border: `1px solid ${isDanger ? "rgba(248,113,113,0.4)" : isWarning ? "rgba(251,191,36,0.4)" : "var(--border)"}`,
                borderRadius: "12px",
                padding: "1rem 1.25rem",
                marginBottom: "1.5rem",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.72rem",
                    color: "var(--muted)",
                    letterSpacing: "0.05em",
                  }}
                >
                  HOLD EXPIRES IN
                </p>
                <p
                  style={{ margin: "4px 0 0" }}
                  className={
                    isDanger
                      ? "countdown-danger"
                      : isWarning
                      ? "countdown-warning"
                      : ""
                  }
                >
                  <span
                    style={{
                      fontFamily: "'DM Mono', monospace",
                      fontSize: "2rem",
                      fontWeight: 700,
                      color: isDanger
                        ? "var(--danger)"
                        : isWarning
                        ? "var(--warning)"
                        : "var(--text)",
                    }}
                  >
                    {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
                  </span>
                </p>
              </div>
              <div
                style={{
                  width: "52px",
                  height: "52px",
                  borderRadius: "50%",
                  border: `3px solid ${isDanger ? "var(--danger)" : isWarning ? "var(--warning)" : "var(--green)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "1.25rem",
                }}
              >
                ⏱
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
                padding: "10px 14px",
                marginBottom: "1rem",
                fontSize: "0.85rem",
                color: "var(--danger)",
              }}
            >
              {error}
            </div>
          )}

          {/* Action Buttons */}
          {isPending && (
            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                onClick={handleConfirm}
                disabled={!!loading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: loading === "confirm" ? "var(--green-dim)" : "var(--green)",
                  color: "#000",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background 0.15s",
                }}
              >
                {loading === "confirm" ? "Processing…" : "Confirm Purchase"}
              </button>
              <button
                onClick={handleCancel}
                disabled={!!loading}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--muted)",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--danger)";
                  e.currentTarget.style.color = "var(--danger)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--muted)";
                }}
              >
                {loading === "cancel" ? "Cancelling…" : "Cancel"}
              </button>
            </div>
          )}

          {(isConfirmed || isReleased) && (
            <button
              onClick={() => router.push("/")}
              style={{
                width: "100%",
                padding: "12px",
                borderRadius: "10px",
                border: "1px solid var(--border)",
                background: "var(--surface-2)",
                color: "var(--text)",
                fontWeight: 600,
                fontSize: "0.9rem",
                cursor: "pointer",
              }}
            >
              ← Back to Products
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBox({
  label,
  value,
  sub,
  valueColor,
  mono,
}: {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
  mono?: boolean;
}) {
  return (
    <div
      style={{
        background: "var(--surface-2)",
        borderRadius: "8px",
        padding: "10px 12px",
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "0.65rem",
          color: "var(--muted)",
          letterSpacing: "0.07em",
        }}
      >
        {label}
      </p>
      <p
        style={{
          margin: "3px 0 0",
          fontSize: "0.85rem",
          fontWeight: 600,
          color: valueColor || "var(--text)",
          fontFamily: mono ? "'DM Mono', monospace" : "inherit",
          wordBreak: "break-all",
        }}
      >
        {value}
      </p>
      {sub && (
        <p style={{ margin: "2px 0 0", fontSize: "0.72rem", color: "var(--muted)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}
