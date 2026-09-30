import { ImageResponse } from "next/og";
import { getPublicProfile } from "@/lib/profile";

export const alt = "Token Maxxer profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function compact(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default async function Image({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const profile = await getPublicProfile(handle).catch(() => null);
  // Private / unknown profiles get the generic card — never a hint that the handle exists.
  const name = profile ? (profile.name ?? `@${profile.handle}`) : "Token Maxxer";
  const big = profile ? compact(profile.totalTokens) : "Show your usage.";
  const sub = profile ? "tokens while building" : "Show what you shipped.";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#f7f6f4", color: "#17150f" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 52, height: 52, borderRadius: 14, background: "#e8622c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>T</div>
          <span>token<span style={{ color: "#e8622c" }}>maxxer</span></span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 40, color: "#6b6863" }}>{name}</div>
          <div style={{ fontSize: 168, fontWeight: 800, lineHeight: 1.05, letterSpacing: -4 }}>{big}</div>
          <div style={{ fontSize: 40, color: "#e8622c" }}>{sub}</div>
        </div>
      </div>
    ),
    size,
  );
}
