// src/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Allo Inventory",
  description: "Multi-warehouse inventory & reservation platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <nav
          style={{
            background: "var(--surface)",
            borderBottom: "1px solid var(--border)",
          }}
          className="px-6 py-4 flex items-center justify-between sticky top-0 z-50"
        >
          <a href="/" className="flex items-center gap-2 no-underline">
            <span
              style={{
                background: "var(--green)",
                color: "#000",
                fontWeight: 700,
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.75rem",
                padding: "2px 8px",
                borderRadius: "4px",
                letterSpacing: "0.1em",
              }}
            >
              ALLO
            </span>
            <span
              style={{ color: "var(--muted)", fontSize: "0.875rem" }}
            >
              inventory
            </span>
          </a>
          <span
            style={{
              color: "var(--muted)",
              fontSize: "0.75rem",
              fontFamily: "'DM Mono', monospace",
            }}
          >
            multi-warehouse · real-time stock
          </span>
        </nav>
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
