/**
 * Flat-earth geospatial helpers used to build cell-sector coverage polygons.
 * Accurate enough for the small radii typical of cellular sectors.
 */

const METERS_PER_DEG_LAT = 111320;

/**
 * Build a filled "pie slice" polygon (origin + arc) for a cell sector.
 * Returns an array of [lat, lon] coordinates, starting and ending at the origin.
 */
export function calculateSectorPolygon(
  lat: number,
  lon: number,
  azimuth: number,
  beamwidth: number,
  radius: number
): [number, number][] {
  const points: [number, number][] = [];
  const steps = Math.max(10, Math.ceil(beamwidth / 2));
  const startAngle = azimuth - beamwidth / 2;
  const endAngle = azimuth + beamwidth / 2;
  const latRad = (lat * Math.PI) / 180;
  const r = Math.max(0, radius || 0);

  points.push([lat, lon]);
  for (let i = 0; i <= steps; i++) {
    const angle = ((startAngle + (endAngle - startAngle) * (i / steps)) * Math.PI) / 180;
    const dLat = (r * Math.cos(angle)) / METERS_PER_DEG_LAT;
    const dLon = (r * Math.sin(angle)) / (METERS_PER_DEG_LAT * Math.cos(latRad));
    points.push([lat + dLat, lon + dLon]);
  }
  points.push([lat, lon]);
  return points;
}

/**
 * Calculate the midpoint of the arc (beam tip) for label placement.
 */
export function beamTipPosition(
  lat: number,
  lon: number,
  azimuth: number,
  radius: number
): { lat: number; lon: number } {
  const r = Math.max(0, radius || 0);
  const angle = (azimuth * Math.PI) / 180;
  const latRad = (lat * Math.PI) / 180;
  const dLat = (r * Math.cos(angle)) / METERS_PER_DEG_LAT;
  const dLon = (r * Math.sin(angle)) / (METERS_PER_DEG_LAT * Math.cos(latRad));
  return { lat: lat + dLat, lon: lon + dLon };
}

type Range = { opMin: string; min: string; opMax: string; max: string };

export function evaluateRangeMatch(value: number, range: Range): boolean {
  let minOk = true;
  let maxOk = true;

  if (range.min !== "" && range.min != null && !isNaN(parseFloat(range.min))) {
    const mn = parseFloat(range.min);
    switch (range.opMin) {
      case ">=":
        minOk = value >= mn;
        break;
      case ">":
        minOk = value > mn;
        break;
      case "=":
        minOk = value === mn;
        break;
      case "!=":
        minOk = value !== mn;
        break;
      default:
        minOk = true;
    }
  }

  if (range.max !== "" && range.max != null && !isNaN(parseFloat(range.max))) {
    const mx = parseFloat(range.max);
    switch (range.opMax) {
      case "<=":
        maxOk = value <= mx;
        break;
      case "<":
        maxOk = value < mx;
        break;
      case "=":
        maxOk = value === mx;
        break;
      case "!=":
        maxOk = value !== mx;
        break;
      case ">=":
        maxOk = value >= mx;
        break;
      case ">":
        maxOk = value > mx;
        break;
      default:
        maxOk = true;
    }
  }

  return minOk && maxOk;
}

/** Convert #RRGGBB + opacity% into KML's AABBGGRR color string. */
export function hexToKml(hex: string, opacityPercent: number): string {
  let h = (hex || "#000000").replace("#", "");
  const a = Math.round(((opacityPercent || 0) / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  if (h.length === 3) {
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = h.substr(0, 2);
  const g = h.substr(2, 2);
  const b = h.substr(4, 2);
  return (a + b + g + r).toUpperCase();
}

export function escapeXml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
