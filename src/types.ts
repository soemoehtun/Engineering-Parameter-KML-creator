export type DataRow = Record<string, string | number>;

/**
 * Site marker config — lean vector circle style (matches Point-File-Creator).
 * Shape pickers / PNG icons are intentionally not used.
 */
export interface IconConfig {
  color: string; // hex e.g. #ef4444
  scale: number; // 0.5 .. 3
  opacity: number; // 0 .. 1
}

export interface ColorRange {
  opMin: string;
  min: string;
  opMax: string;
  max: string;
  color: string;
}

export interface IconRange {
  opMin: string;
  min: string;
  opMax: string;
  max: string;
  iconConfig: IconConfig;
}

export interface Mapping {
  SiteName: string;
  SectorName: string;
  Longitude: string;
  Latitude: string;
  Azimuth: string;
  ColorCode: string;
  BeamCategory: string;
  RadiusCategory: string;
  IconCategory: string;
  /** Column shown as the permanent cell label. Empty = Sector Name. */
  CellLabelCol: string;
  sitePopupCols: string[];
  sectorPopupCols: string[];
}

export interface Legends {
  color: Record<string, string>;
  beam: Record<string, string>;
  radius: Record<string, string>;
  icons: Record<string, IconConfig>;
}

export interface Visibility {
  beams: boolean;
  siteMarkers: boolean;
  siteLabels: boolean;
  cellLabels: boolean;
}

export interface SiteMarker {
  site: string;
  lat: number;
  lon: number;
  icon: IconConfig;
  popupHtml: string;
  label: string;
}

export interface SectorShape {
  lat: number;
  lon: number;
  polygon: [number, number][]; // [lat, lon]
  color: string;
  opacity: number; // 0..1 (web opacity)
  popupHtml: string;
  label: string;
  /** Label position at beam tip (arc midpoint) */
  labelLat: number;
  labelLon: number;
  /** Antenna parameters for tilt-coverage calculation */
  azimuth?: number;
  antHeight?: number;
  tilt?: number;
}

export type BaseLayerKey = "light" | "dark" | "satellite" | "osm";
