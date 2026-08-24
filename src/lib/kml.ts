import JSZip from "jszip";
import type {
  ColorRange,
  DataRow,
  IconConfig,
  IconRange,
  Legends,
  Mapping,
} from "../types";
import { calculateSectorPolygon, escapeXml, evaluateRangeMatch, hexToKml } from "./geo";
import { circlePngBase64 } from "./icons";

export interface ExportConfig {
  rows: DataRow[];
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
  opacity: number;
  globalIconScale: number;
  markerOpacity: number;
  showSiteLabels: boolean;
  showCellLabels: boolean;
  exportAppearance: "map" | "custom";
  exportMode: "single" | "category";
  exportIconUrl: string;
  exportIconColor: string;
  exportIconScale: number;
  exportIconOpacity: number;
  exportCategoryIcons: Record<string, string>;
  /** Per-category KMZ icon colour. Empty entry = inherit the map colour. */
  exportCategoryColors: Record<string, string>;
}

/**
 * Clean Google-Earth-friendly balloon.
 * Mirrors the original Engineering-Parameter-KML-creator output:
 *   title in bold + simple key/value table.
 * This is intentionally simpler than the on-map .pg-pop card,
 * because GE strips complex CSS.
 */
function popupCard(
  row: DataRow,
  cols: string[],
  title: string,
  _accent: string
): string {
  const shown = (cols || []).filter(Boolean);

  let rowsHtml = "";
  if (shown.length) {
    shown.forEach((f) => {
      const raw = row[f];
      const val = raw === null || raw === undefined ? "" : String(raw).trim();
      rowsHtml +=
        `<tr>` +
        `<td style="padding:3px 12px 3px 0;color:#4a5a57;font-size:12px;white-space:nowrap;vertical-align:top"><b>${escapeXml(f)}:</b></td>` +
        `<td style="padding:3px 0;color:#143b3d;font-size:12px;vertical-align:top">${val ? escapeXml(val) : "—"}</td>` +
        `</tr>`;
    });
  } else {
    rowsHtml = `<tr><td style="padding:6px 0;color:#849692;font-style:italic;font-size:11px">No popup columns selected</td></tr>`;
  }

  return (
    `<div style="font-family:Arial,Helvetica,sans-serif;min-width:200px">` +
    `<div style="font-size:13px;font-weight:700;color:#122f31;margin:0 0 8px 0">${escapeXml(title || "Point")}</div>` +
    `<table cellspacing="0" cellpadding="0" style="border-collapse:collapse">${rowsHtml}</table>` +
    `</div>`
  );
}

function safeCdata(html: string): string {
  return html.replace(/]]>/g, "]]><![CDATA[>");
}

import { VECTOR_CIRCLE, NO_ICON } from "./kmlIcons";

function resolveIcon(row: DataRow, cfg: ExportConfig): IconConfig {
  let iconCfg: IconConfig = { ...cfg.defaultIcon };
  const { mapping } = cfg;
  if (mapping.IconCategory) {
    if (cfg.iconMode === "range") {
      const numVal = parseFloat(String(row[mapping.IconCategory]));
      if (!isNaN(numVal)) {
        for (const range of cfg.iconRanges) {
          if (evaluateRangeMatch(numVal, range)) {
            iconCfg = range.iconConfig;
            break;
          }
        }
      }
    } else if (cfg.legends.icons[row[mapping.IconCategory]]) {
      iconCfg = cfg.legends.icons[row[mapping.IconCategory]];
    }
  }
  return iconCfg;
}

/** Short stable token from an icon href, for building unique ids. */
function hashHref(href: string): string {
  let h = 0;
  for (let i = 0; i < href.length; i++) {
    h = Math.imul(31, h) + href.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString(16);
}

export function exportKmz(cfg: ExportConfig): boolean {
  const {
    rows,
    mapping,
    legends,
    colorRanges,
    colorMode,
    defaultSectorColor,
    defaultBeamwidth,
    defaultRadius,
    opacity,
    globalIconScale,
    markerOpacity,
    showSiteLabels,
    showCellLabels,
  } = cfg;

  if (!rows.length) return false;

  let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
<Document>
  <name>Network Export</name>
  <Folder>
    <name>Sites</name>`;

  const sitesProcessed: Record<string, boolean> = {};
  let styleCounter = 0;
  const markerOp = Math.max(0, Math.min(100, markerOpacity ?? 100)) / 100;

  const mapAppearance = cfg.exportAppearance === "map";

  rows.forEach((row) => {
    const site = row[mapping.SiteName];
    const lon = parseFloat(String(row[mapping.Longitude]));
    const lat = parseFloat(String(row[mapping.Latitude]));
    if (!site || isNaN(lon) || isNaN(lat)) return;
    if (sitesProcessed[String(site)]) return;
    sitesProcessed[String(site)] = true;

    const mapIcon = resolveIcon(row, cfg);
    const category = mapping.IconCategory ? String(row[mapping.IconCategory] ?? "") : "";

    const url = mapAppearance 
      ? VECTOR_CIRCLE 
      : cfg.exportMode === "category" 
        ? cfg.exportCategoryIcons[category] ?? cfg.exportIconUrl 
        : cfg.exportIconUrl;
        
    const finalColor = mapAppearance
      ? mapIcon.color
      : cfg.exportMode === "category"
        ? cfg.exportCategoryColors[category] || mapIcon.color
        : cfg.exportIconColor || mapIcon.color;
      
    const finalScale = mapAppearance 
      ? Math.max(0.1, Math.min(4, ((mapIcon.scale || 1) * (globalIconScale || 1)) / 3.2))
      : cfg.exportIconScale;
      
    const finalOp = mapAppearance 
      ? (mapIcon.opacity ?? 1) * markerOp 
      : cfg.exportIconOpacity;

    const desc = popupCard(row, mapping.sitePopupCols, String(site), finalColor);
    
    const isVector = url === VECTOR_CIRCLE;
    const isNone = url === NO_ICON;
    const href = isVector ? "files/circle.png" : url;
    
    const kmlColor = hexToKml(finalColor, finalOp * 100);
    const styleId = `s_${finalColor.replace("#", "")}_${isVector ? "vec" : hashHref(url)}`;

    kml += `
      <Style id="${styleId}">
        <IconStyle>
          <color>${kmlColor}</color>
          <scale>${isNone ? "0" : finalScale.toFixed(2)}</scale>
          ${isNone ? "" : `<Icon><href>${escapeXml(href)}</href></Icon>`}
        </IconStyle>
        <LabelStyle><scale>0</scale></LabelStyle>
        <BalloonStyle>
          <bgColor>ffffffff</bgColor>
          <text><![CDATA[
            <div style="font-family:Arial,sans-serif;font-size:12px;color:#183c3e">$[description]</div>
          ]]></text>
        </BalloonStyle>
      </Style>
      <Placemark>
        <name>${escapeXml(site)}</name>
        <description><![CDATA[${safeCdata(desc)}]]></description>
        <styleUrl>#${styleId}</styleUrl>
        <Point><coordinates>${lon},${lat},0</coordinates></Point>
      </Placemark>`;
      if (showSiteLabels) {
        const labelStyleId = `sl_${styleId}`;
        kml += `
      <Style id="${labelStyleId}">
        <IconStyle>
          <color>00000000</color>
          <scale>0</scale>
          <Icon><href>https://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon>
        </IconStyle>
        <LabelStyle>
          <scale>0.8</scale>
          <color>ffffffff</color>
        </LabelStyle>
        <BalloonStyle>
          <bgColor>ffffffff</bgColor>
          <text><![CDATA[
            <div style="font-family:Arial,sans-serif;font-size:12px;color:#183c3e">$[description]</div>
          ]]></text>
        </BalloonStyle>
      </Style>
      <Placemark>
        <name>${escapeXml(site)}</name>
        <description><![CDATA[${safeCdata(desc)}]]></description>
        <styleUrl>#${labelStyleId}</styleUrl>
        <Point><coordinates>${lon},${lat},0</coordinates></Point>
      </Placemark>`;
      }
  });

  kml += `
  </Folder>
  <Folder>
    <name>Sectors</name>`;

  rows.forEach((row) => {
    const secRaw = row[mapping.SectorName];
    const sectorName = String(secRaw ?? "");
    const cellLabel = mapping.CellLabelCol
      ? String(row[mapping.CellLabelCol] ?? "") || sectorName
      : sectorName;
    const lon = parseFloat(String(row[mapping.Longitude]));
    const lat = parseFloat(String(row[mapping.Latitude]));
    const az = parseFloat(String(row[mapping.Azimuth]));
    if (isNaN(lat) || isNaN(lon) || isNaN(az)) return;

    let bw = defaultBeamwidth;
    let rad = defaultRadius;
    let color = defaultSectorColor;
    if (mapping.BeamCategory && legends.beam[row[mapping.BeamCategory]]) {
      const v = parseFloat(legends.beam[row[mapping.BeamCategory]]);
      if (!isNaN(v)) bw = v;
    }
    if (mapping.RadiusCategory && legends.radius[row[mapping.RadiusCategory]]) {
      const v = parseFloat(legends.radius[row[mapping.RadiusCategory]]);
      if (!isNaN(v)) rad = v;
    }
    if (mapping.ColorCode) {
      if (colorMode === "range") {
        const numVal = parseFloat(String(row[mapping.ColorCode]));
        if (!isNaN(numVal)) {
          for (const range of colorRanges) {
            if (evaluateRangeMatch(numVal, range)) {
              color = range.color;
              break;
            }
          }
        }
      } else if (legends.color[row[mapping.ColorCode]]) {
        color = legends.color[row[mapping.ColorCode]];
      }
    }

    const kmlColor = hexToKml(color, opacity);
    const desc = popupCard(row, mapping.sectorPopupCols, sectorName, color);
    const poly = calculateSectorPolygon(lat, lon, az, bw, rad);
    const kmlCoords = poly
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]))
      .map((c) => `${c[1]},${c[0]},0`)
      .join(" ");
    if (!kmlCoords) return;

    const styleId = `s_sec_${styleCounter++}`;
    kml += `
      <Style id="${styleId}">
        <LineStyle><color>${kmlColor}</color><width>1</width></LineStyle>
        <PolyStyle><color>${kmlColor}</color><fill>1</fill><outline>1</outline></PolyStyle>
        <LabelStyle><scale>0</scale></LabelStyle>
        <BalloonStyle>
          <bgColor>ffffffff</bgColor>
          <text><![CDATA[
            <div style="font-family:Arial,sans-serif;font-size:12px;color:#183c3e">$[description]</div>
          ]]></text>
        </BalloonStyle>
      </Style>
      <Placemark>
        <name>${escapeXml(sectorName)}</name>
        <description><![CDATA[${safeCdata(desc)}]]></description>
        <styleUrl>#${styleId}</styleUrl>
        <Polygon>
          <tessellate>1</tessellate>
          <outerBoundaryIs><LinearRing><coordinates>${kmlCoords}</coordinates></LinearRing></outerBoundaryIs>
        </Polygon>
      </Placemark>`;

    if (showCellLabels) {
      // Place label at beam tip (arc midpoint at radius distance along azimuth)
      const METERS_PER_DEG_LAT = 111320;
      const azRad = (az * Math.PI) / 180;
      const latRad = (lat * Math.PI) / 180;
      const tipLat = lat + (rad * Math.cos(azRad)) / METERS_PER_DEG_LAT;
      const tipLon = lon + (rad * Math.sin(azRad)) / (METERS_PER_DEG_LAT * Math.cos(latRad));
      const labelStyleId = `s_cl_${styleCounter}`;
      kml += `
      <Style id="${labelStyleId}">
        <IconStyle>
          <color>00000000</color>
          <scale>0</scale>
          <Icon><href>https://maps.google.com/mapfiles/kml/shapes/shaded_dot.png</href></Icon>
        </IconStyle>
        <LabelStyle>
          <scale>0.75</scale>
          <color>ffffffff</color>
        </LabelStyle>
        <BalloonStyle>
          <bgColor>ffffffff</bgColor>
          <text><![CDATA[
            <div style="font-family:Arial,sans-serif;font-size:12px;color:#183c3e">$[description]</div>
          ]]></text>
        </BalloonStyle>
      </Style>
      <Placemark>
        <name>${escapeXml(cellLabel)}</name>
        <description><![CDATA[${safeCdata(desc)}]]></description>
        <styleUrl>#${labelStyleId}</styleUrl>
        <Point><coordinates>${tipLon.toFixed(8)},${tipLat.toFixed(8)},0</coordinates></Point>
      </Placemark>`;
    }
  });

  kml += `
  </Folder>
</Document>
</kml>`;

  if (Object.keys(sitesProcessed).length === 0) return false;

  const zip = new JSZip();
  zip.file("doc.kml", kml);
  
  // Only pack the circle.png sprite if any placemark actually uses the VECTOR_CIRCLE
  const usesVector = cfg.exportAppearance === "map" || cfg.exportIconUrl === VECTOR_CIRCLE || Object.values(cfg.exportCategoryIcons || {}).includes(VECTOR_CIRCLE);
  if (usesVector) {
    zip.folder("files")!.file("circle.png", circlePngBase64(), { base64: true });
  }
  
  zip.generateAsync({ type: "blob", mimeType: "application/vnd.google-earth.kmz" }).then((blob) => {
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "Engineering Parameter Export.kmz";
    link.click();
    URL.revokeObjectURL(link.href);
  });
  return true;
}
