import type { IconConfig } from "../types";

/**
 * Lean vector-circle helpers, matching Point-File-Creator's Style-tab approach.
 * No PNG sprites, no shape catalogue — every site is a coloured circle.
 */

export const DEFAULT_ICON: IconConfig = {
  color: "#ef4444",
  scale: 1,
  opacity: 1,
};

export const PALETTE = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#64748b",
  "#6366f1",
  "#0ea5e9",
];

export const paletteColor = (i: number) =>
  PALETTE[((i % PALETTE.length) + PALETTE.length) % PALETTE.length];

/**
 * Leaflet CircleMarker radius (px) — matches Point-File-Creator:
 *   radius = Math.max(2, 5 * markerSize)
 */
export function circleRadius(icon: IconConfig, globalScale = 1): number {
  return Math.max(2, 5 * (icon.scale || 1) * (globalScale || 1));
}

/**
 * Generate a white circle PNG (base64, no data: prefix) for packing into KMZ.
 * Google Earth multiplies KML <color> against the sprite, so white tints cleanly.
 * Generated at runtime via canvas — never used as a web-map asset.
 */
export function circlePngBase64(): string {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  // strip data:image/png;base64,
  return canvas.toDataURL("image/png").split(",")[1] || "";
}

/**
 * Inline SVG data-URI for a solid circle (used only when we need an <img>
 * preview in the Style tab — pure vector, no PNG).
 */
export function circleDataUri(color: string, size = 28): string {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">` +
    `<circle cx="16" cy="16" r="12" fill="${color}" stroke="#ffffff" stroke-width="2"/>` +
    `</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
