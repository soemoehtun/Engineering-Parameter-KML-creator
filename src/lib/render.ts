import type {
  ColorRange,
  DataRow,
  IconConfig,
  IconRange,
  Legends,
  Mapping,
  SectorShape,
  SiteMarker,
} from "../types";
import { calculateSectorPolygon, escapeXml, evaluateRangeMatch } from "./geo";

export interface ResolveConfig {
  mapping: Mapping;
  legends: Legends;
  colorRanges: ColorRange[];
  iconRanges: IconRange[];
  colorMode: "category" | "range";
  iconMode: "category" | "range";
  defaultIcon: IconConfig;
  defaultSectorColor: string;
  defaultBeamwidth: number;
  defaultRadius: number;
  opacity: number; // percent 0..100
  globalIconScale: number;
}

export interface RowStyle {
  icon: IconConfig;
  color: string;
  beamwidth: number;
  radius: number;
}

export function resolveRowStyle(row: DataRow, cfg: ResolveConfig): RowStyle {
  let icon: IconConfig = { ...cfg.defaultIcon };
  let color = cfg.defaultSectorColor;
  let beamwidth = cfg.defaultBeamwidth;
  let radius = cfg.defaultRadius;
  const { mapping } = cfg;

  if (mapping.IconCategory) {
    if (cfg.iconMode === "range") {
      const n = parseFloat(String(row[mapping.IconCategory]));
      if (!isNaN(n)) {
        for (const r of cfg.iconRanges) {
          if (evaluateRangeMatch(n, r)) {
            icon = r.iconConfig;
            break;
          }
        }
      }
    } else if (cfg.legends.icons[row[mapping.IconCategory]]) {
      icon = cfg.legends.icons[row[mapping.IconCategory]];
    }
  }

  if (mapping.ColorCode) {
    if (cfg.colorMode === "range") {
      const n = parseFloat(String(row[mapping.ColorCode]));
      if (!isNaN(n)) {
        for (const r of cfg.colorRanges) {
          if (evaluateRangeMatch(n, r)) {
            color = r.color;
            break;
          }
        }
      }
    } else if (cfg.legends.color[row[mapping.ColorCode]]) {
      color = cfg.legends.color[row[mapping.ColorCode]];
    }
  }

  if (mapping.BeamCategory && cfg.legends.beam[row[mapping.BeamCategory]]) {
    const v = parseFloat(cfg.legends.beam[row[mapping.BeamCategory]]);
    if (!isNaN(v)) beamwidth = v;
  }
  if (mapping.RadiusCategory && cfg.legends.radius[row[mapping.RadiusCategory]]) {
    const v = parseFloat(cfg.legends.radius[row[mapping.RadiusCategory]]);
    if (!isNaN(v)) radius = v;
  }

  return { icon, color, beamwidth, radius };
}

function buildPopup(
  row: DataRow,
  cols: string[],
  name: string,
  accent?: string
): string {
  // Reference behaviour: render every selected column, showing "—" when empty.
  const shown = (cols || []).filter(Boolean);
  let body = "";
  for (const c of shown) {
    const raw = row[c];
    const val = raw === null || raw === undefined ? "" : String(raw).trim();
    body +=
      `<div class="pg-pop-row">` +
      `<span class="pg-pop-k">${escapeXml(c)}</span>` +
      `<span class="pg-pop-v">${val ? escapeXml(val) : "—"}</span>` +
      `</div>`;
  }
  if (!body) {
    body = `<div class="pg-pop-row"><span class="pg-pop-empty">No popup columns selected.</span></div>`;
  }

  const dot = accent
    ? `<span class="pg-pop-dot" style="background:${escapeXml(accent)}"></span>`
    : "";

  return (
    `<div class="pg-pop">` +
    `<div class="pg-pop-head">${dot}` +
    `<span class="pg-pop-title">${escapeXml(name || "Point")}</span></div>` +
    `<div class="pg-pop-body">${body}</div>` +
    `</div>`
  );
}

export function computeSites(rows: DataRow[], cfg: ResolveConfig): SiteMarker[] {
  const out: SiteMarker[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const site = String(row[cfg.mapping.SiteName] ?? "");
    const lon = parseFloat(String(row[cfg.mapping.Longitude]));
    const lat = parseFloat(String(row[cfg.mapping.Latitude]));
    if (!site || isNaN(lon) || isNaN(lat)) continue;
    if (seen.has(site)) continue;
    seen.add(site);
    const style = resolveRowStyle(row, cfg);
    out.push({
      site,
      lat,
      lon,
      icon: { ...style.icon, scale: (style.icon.scale || 1) * (cfg.globalIconScale || 1) },
      label: site,
      popupHtml: buildPopup(row, cfg.mapping.sitePopupCols, site, style.icon.color),
    });
  }
  return out;
}

export function computeSectors(rows: DataRow[], cfg: ResolveConfig): SectorShape[] {
  const out: SectorShape[] = [];
  const opPct = Math.max(0, Math.min(100, cfg.opacity ?? 100)) / 100;
  // Column assigned as the permanent cell label (defaults to Sector Name).
  const labelCol = cfg.mapping.CellLabelCol || cfg.mapping.SectorName;
  for (const row of rows) {
    const sec = String(row[cfg.mapping.SectorName] ?? "");
    const label = String(row[labelCol] ?? "") || sec;
    const lon = parseFloat(String(row[cfg.mapping.Longitude]));
    const lat = parseFloat(String(row[cfg.mapping.Latitude]));
    const az = parseFloat(String(row[cfg.mapping.Azimuth]));
    if (isNaN(lat) || isNaN(lon) || isNaN(az)) continue;
    const style = resolveRowStyle(row, cfg);
    const poly = calculateSectorPolygon(lat, lon, az, style.beamwidth, style.radius);

    out.push({
      lat,
      lon,
      polygon: poly,
      color: style.color,
      opacity: opPct,
      label,
      popupHtml: buildPopup(row, cfg.mapping.sectorPopupCols, sec, style.color),
    });
  }
  return out;
}
