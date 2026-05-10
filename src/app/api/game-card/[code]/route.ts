import { NextResponse } from "next/server";

const GAME_META: Record<string, { label: string; accent: string; base: string }> = {
  "lineage-w": { label: "Lineage W", accent: "#00b8f0", base: "#111827" },
  "lineage-classic": { label: "Lineage Classic", accent: "#ef6f86", base: "#1f2937" },
  "aion-2": { label: "Aion 2", accent: "#38bdf8", base: "#0f172a" },
  "lineage-m": { label: "Lineage M", accent: "#f59e0b", base: "#111827" },
  "maplestory-worlds": { label: "MapleStory Worlds", accent: "#00b8f0", base: "#164e63" },
  "lord-nine": { label: "Lord Nine", accent: "#c084fc", base: "#1e1b4b" },
  "chosun-hyeopgaekjeon-classic": { label: "Chosun Classic", accent: "#ef4444", base: "#18181b" },
  vampir: { label: "Vampir", accent: "#f43f5e", base: "#2d0a13" },
  "night-crows": { label: "Night Crows", accent: "#818cf8", base: "#111827" },
  lineage2m: { label: "Lineage2M", accent: "#14b8a6", base: "#0f172a" },
  "archetic-land": { label: "Archetic Land", accent: "#facc15", base: "#1f2937" },
  "rf-online-next": { label: "RF Online Next", accent: "#60a5fa", base: "#172554" },
  "ragnarok-online": { label: "Ragnarok Online", accent: "#fb7185", base: "#3b0764" },
  "dungeon-fighter": { label: "Dungeon Fighter", accent: "#fb923c", base: "#18181b" },
  "odin-valhalla-rising": { label: "Odin Valhalla", accent: "#fbbf24", base: "#1e293b" },
  "genshin-impact": { label: "Genshin Impact", accent: "#67e8f9", base: "#164e63" },
};

export async function GET(_request: Request, context: { params: Promise<{ code: string }> }) {
  const { code } = await context.params;
  const key = normalizeCode(code);
  const meta = GAME_META[key] ?? {
    label: titleCase(key),
    accent: "#00b8f0",
    base: "#111827",
  };
  const initials = meta.label
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  const svg = buildSvg(meta.label, initials, meta.accent, meta.base);

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

function buildSvg(label: string, initials: string, accent: string, base: string) {
  const safeLabel = escapeSvg(label);
  const safeInitials = escapeSvg(initials);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="${safeLabel}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${base}"/>
      <stop offset="0.56" stop-color="#0b1220"/>
      <stop offset="1" stop-color="#f8fbff"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${accent}" stop-opacity=".95"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity=".9"/>
    </linearGradient>
  </defs>
  <rect width="640" height="480" rx="48" fill="url(#bg)"/>
  <circle cx="526" cy="92" r="132" fill="${accent}" opacity=".2"/>
  <circle cx="98" cy="390" r="150" fill="${accent}" opacity=".18"/>
  <path d="M96 336 C184 224 250 378 336 252 C398 160 470 164 548 118" fill="none" stroke="url(#shine)" stroke-width="22" stroke-linecap="round"/>
  <rect x="56" y="58" width="146" height="52" rx="26" fill="#ffffff" opacity=".92"/>
  <text x="82" y="93" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="900" fill="${accent}">GGtem</text>
  <text x="78" y="258" font-family="Arial, Helvetica, sans-serif" font-size="92" font-weight="900" fill="#ffffff">${safeInitials}</text>
  <text x="80" y="323" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="900" fill="#ffffff">${safeLabel}</text>
  <rect x="80" y="352" width="220" height="10" rx="5" fill="${accent}"/>
</svg>`;
}

function normalizeCode(code: string) {
  return decodeURIComponent(code).trim().toLowerCase();
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeSvg(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
